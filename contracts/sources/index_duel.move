/// IndexDuel: Core duel smart contract for Sui-Index.
/// Handles escrow, portfolio submission, activation, settlement, and payout.
/// Each duel is a shared object that holds SUI in escrow until settlement.
module sui_index::index_duel {
    use std::string::String;
    use sui::coin::{Self, Coin};
    use sui::sui::SUI;
    use sui::balance::{Self, Balance};
    use sui::clock::Clock;
    use sui::event;

    // ============ Error Constants ============

    const ENotCreator: u64 = 0;
    const ENotSettler: u64 = 1;
    const EDuelNotOpen: u64 = 2;
    const EDuelNotActive: u64 = 3;
    const EInsufficientPayment: u64 = 4;
    const EDuelAlreadySettled: u64 = 5;
    const EDuelNotExpired: u64 = 6;
    const ECannotJoinOwnDuel: u64 = 7;
    const EInvalidReturnValues: u64 = 8;

    // ============ Status Constants ============

    const STATUS_OPEN: u8 = 0;
    const STATUS_ACTIVE: u8 = 1;
    const STATUS_SETTLED: u8 = 2;
    const STATUS_CANCELLED: u8 = 3;

    // ============ Structs ============

    /// Admin capability for the settlement authority.
    public struct AdminCap has key, store {
        id: UID,
    }

    /// A duel between two players competing with weighted crypto indexes.
    public struct Duel has key {
        id: UID,
        /// Address of the player who created the duel.
        creator: address,
        /// Address of the opponent (0x0 until joined).
        opponent: address,
        /// Entry amount in SUI (in MIST, 1 SUI = 10^9 MIST).
        entry_amount: u64,
        /// Duration of the duel in milliseconds.
        duration_ms: u64,
        /// Current duel status.
        status: u8,
        /// Walrus blob ID storing the creator's index composition.
        creator_blob_id: String,
        /// Walrus blob ID storing the opponent's index composition.
        opponent_blob_id: String,
        /// Timestamp (ms) when the duel became active (opponent joined).
        start_time: u64,
        /// Timestamp (ms) when the duel ends.
        end_time: u64,
        /// Walrus blob ID storing the start price snapshot.
        start_prices_blob_id: String,
        /// SUI balance held in escrow.
        escrow: Balance<SUI>,
        /// Winner address (0x0 until settled).
        winner: address,
        /// Walrus blob ID storing the duel result.
        result_blob_id: String,
        /// Platform fee in basis points (e.g. 200 = 2%).
        platform_fee_bps: u64,
    }

    // ============ Events ============

    public struct DuelCreated has copy, drop {
        duel_id: ID,
        creator: address,
        entry_amount: u64,
        duration_ms: u64,
        creator_blob_id: String,
    }

    public struct DuelJoined has copy, drop {
        duel_id: ID,
        opponent: address,
        opponent_blob_id: String,
        start_time: u64,
        end_time: u64,
    }

    public struct DuelSettled has copy, drop {
        duel_id: ID,
        winner: address,
        creator_return_bps: u64,
        opponent_return_bps: u64,
        result_blob_id: String,
    }

    public struct DuelCancelled has copy, drop {
        duel_id: ID,
        creator: address,
    }

    // ============ Init ============

    /// Publish creates the AdminCap and sends it to the deployer.
    fun init(ctx: &mut TxContext) {
        let admin_cap = AdminCap {
            id: object::new(ctx),
        };
        transfer::transfer(admin_cap, ctx.sender());
    }

    // ============ Core Functions ============

    /// Create a new duel. The creator deposits their entry amount and submits their index blob ID.
    public entry fun create_duel(
        payment: Coin<SUI>,
        entry_amount: u64,
        duration_ms: u64,
        creator_blob_id: String,
        platform_fee_bps: u64,
        clock: &Clock,
        ctx: &mut TxContext,
    ) {
        // Validate payment
        assert!(coin::value(&payment) >= entry_amount, EInsufficientPayment);

        // If overpaid, split and return change
        let mut payment_mut = payment;
        let paid = coin::value(&payment_mut);
        if (paid > entry_amount) {
            let change = coin::split(&mut payment_mut, paid - entry_amount, ctx);
            transfer::public_transfer(change, ctx.sender());
        };

        let duel = Duel {
            id: object::new(ctx),
            creator: ctx.sender(),
            opponent: @0x0,
            entry_amount,
            duration_ms,
            status: STATUS_OPEN,
            creator_blob_id,
            opponent_blob_id: std::string::utf8(b""),
            start_time: 0,
            end_time: 0,
            start_prices_blob_id: std::string::utf8(b""),
            escrow: coin::into_balance(payment_mut),
            winner: @0x0,
            result_blob_id: std::string::utf8(b""),
            platform_fee_bps,
        };

        let duel_id = object::id(&duel);

        event::emit(DuelCreated {
            duel_id,
            creator: ctx.sender(),
            entry_amount,
            duration_ms,
            creator_blob_id,
        });

        // Suppress unused variable warning
        let _ = clock;

        transfer::share_object(duel);
    }

    /// Opponent joins an open duel by depositing matching entry amount and submitting their index.
    public entry fun join_duel(
        duel: &mut Duel,
        payment: Coin<SUI>,
        opponent_blob_id: String,
        start_prices_blob_id: String,
        clock: &Clock,
        ctx: &mut TxContext,
    ) {
        assert!(duel.status == STATUS_OPEN, EDuelNotOpen);
        assert!(ctx.sender() != duel.creator, ECannotJoinOwnDuel);
        assert!(coin::value(&payment) >= duel.entry_amount, EInsufficientPayment);

        // Handle overpayment
        let mut payment_mut = payment;
        let paid = coin::value(&payment_mut);
        if (paid > duel.entry_amount) {
            let change = coin::split(&mut payment_mut, paid - duel.entry_amount, ctx);
            transfer::public_transfer(change, ctx.sender());
        };

        // Add opponent's funds to escrow
        let payment_balance = coin::into_balance(payment_mut);
        balance::join(&mut duel.escrow, payment_balance);

        // Record opponent info
        duel.opponent = ctx.sender();
        duel.opponent_blob_id = opponent_blob_id;
        duel.start_prices_blob_id = start_prices_blob_id;
        duel.status = STATUS_ACTIVE;

        // Set timing
        let now = sui::clock::timestamp_ms(clock);
        duel.start_time = now;
        duel.end_time = now + duel.duration_ms;

        event::emit(DuelJoined {
            duel_id: object::id(duel),
            opponent: ctx.sender(),
            opponent_blob_id,
            start_time: duel.start_time,
            end_time: duel.end_time,
        });
    }

    /// Settle a duel after it expires. Only callable by AdminCap holder.
    /// Returns are in basis points (10000 = 100% = no change, 11000 = +10%, 9000 = -10%).
    public entry fun settle_duel(
        _admin: &AdminCap,
        duel: &mut Duel,
        creator_return_bps: u64,
        opponent_return_bps: u64,
        result_blob_id: String,
        clock: &Clock,
        ctx: &mut TxContext,
    ) {
        assert!(duel.status == STATUS_ACTIVE, EDuelNotActive);

        // Ensure duel has expired
        let now = sui::clock::timestamp_ms(clock);
        assert!(now >= duel.end_time, EDuelNotExpired);

        // Determine winner (higher return wins, creator wins ties)
        let winner = if (creator_return_bps >= opponent_return_bps) {
            duel.creator
        } else {
            duel.opponent
        };

        duel.winner = winner;
        duel.status = STATUS_SETTLED;
        duel.result_blob_id = result_blob_id;

        // Calculate platform fee
        let total_escrow = balance::value(&duel.escrow);
        let fee_amount = (total_escrow * duel.platform_fee_bps) / 10000;
        let winner_amount = total_escrow - fee_amount;

        // Pay winner
        let winner_coin = coin::from_balance(
            balance::split(&mut duel.escrow, winner_amount),
            ctx,
        );
        transfer::public_transfer(winner_coin, winner);

        // Pay fee to admin (remaining escrow)
        let remaining = balance::value(&duel.escrow);
        if (remaining > 0) {
            let fee_coin = coin::from_balance(
                balance::split(&mut duel.escrow, remaining),
                ctx,
            );
            transfer::public_transfer(fee_coin, ctx.sender());
        };

        event::emit(DuelSettled {
            duel_id: object::id(duel),
            winner,
            creator_return_bps,
            opponent_return_bps,
            result_blob_id,
        });

        // Suppress unused variable warning
        let _ = clock;
    }

    /// Creator cancels an open duel (before anyone joins). Full refund.
    public entry fun cancel_duel(
        duel: &mut Duel,
        ctx: &mut TxContext,
    ) {
        assert!(duel.status == STATUS_OPEN, EDuelNotOpen);
        assert!(ctx.sender() == duel.creator, ENotCreator);

        duel.status = STATUS_CANCELLED;

        // Refund creator
        let refund_amount = balance::value(&duel.escrow);
        if (refund_amount > 0) {
            let refund = coin::from_balance(
                balance::split(&mut duel.escrow, refund_amount),
                ctx,
            );
            transfer::public_transfer(refund, duel.creator);
        };

        event::emit(DuelCancelled {
            duel_id: object::id(duel),
            creator: duel.creator,
        });
    }

    // ============ View Functions ============

    public fun get_status(duel: &Duel): u8 { duel.status }
    public fun get_creator(duel: &Duel): address { duel.creator }
    public fun get_opponent(duel: &Duel): address { duel.opponent }
    public fun get_entry_amount(duel: &Duel): u64 { duel.entry_amount }
    public fun get_duration_ms(duel: &Duel): u64 { duel.duration_ms }
    public fun get_winner(duel: &Duel): address { duel.winner }
    public fun get_creator_blob_id(duel: &Duel): String { duel.creator_blob_id }
    public fun get_opponent_blob_id(duel: &Duel): String { duel.opponent_blob_id }
    public fun get_start_time(duel: &Duel): u64 { duel.start_time }
    public fun get_end_time(duel: &Duel): u64 { duel.end_time }
    public fun get_escrow_value(duel: &Duel): u64 { balance::value(&duel.escrow) }
    public fun get_result_blob_id(duel: &Duel): String { duel.result_blob_id }

    // ============ Test Helpers ============

    #[test_only]
    public fun init_for_testing(ctx: &mut TxContext) {
        init(ctx);
    }
}
