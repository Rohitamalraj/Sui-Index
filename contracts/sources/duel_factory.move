/// DuelFactory: Registry of all duels, enabling on-chain pagination and listing.
/// Stores references to all duel IDs and metadata for efficient querying.
module sui_index::duel_factory {
    use std::string::String;
    use sui::vec_map::{Self, VecMap};
    use sui::event;

    // ============ Error Constants ============

    const ENotAdmin: u64 = 0;
    const EDuelAlreadyRegistered: u64 = 1;

    // ============ Structs ============

    /// Shared registry that indexes all created duels.
    public struct DuelRegistry has key {
        id: UID,
        /// Admin address.
        admin: address,
        /// Maps duel object ID → DuelMeta for fast lookup.
        duels: VecMap<ID, DuelMeta>,
        /// Total duels ever created.
        total_created: u64,
        /// Platform fee in basis points (default 200 = 2%).
        platform_fee_bps: u64,
    }

    /// Lightweight metadata stored per duel in the registry.
    public struct DuelMeta has store, copy, drop {
        duel_id: ID,
        creator: address,
        entry_amount: u64,
        duration_ms: u64,
        status: u8,           // mirrors DuelStatus in index_duel
        created_at: u64,
        creator_blob_id: String,
    }

    // ============ Events ============

    public struct DuelRegistered has copy, drop {
        duel_id: ID,
        creator: address,
        entry_amount: u64,
    }

    public struct DuelStatusUpdated has copy, drop {
        duel_id: ID,
        new_status: u8,
    }

    // ============ Init ============

    fun init(ctx: &mut TxContext) {
        let registry = DuelRegistry {
            id: object::new(ctx),
            admin: ctx.sender(),
            duels: vec_map::empty(),
            total_created: 0,
            platform_fee_bps: 200, // 2%
        };
        transfer::share_object(registry);
    }

    // ============ Public Functions ============

    /// Register a newly created duel in the factory.
    /// Called by anyone (typically by the duel creator right after create_duel).
    public entry fun register_duel(
        registry: &mut DuelRegistry,
        duel_id: ID,
        creator: address,
        entry_amount: u64,
        duration_ms: u64,
        creator_blob_id: String,
        clock: &sui::clock::Clock,
        ctx: &TxContext,
    ) {
        // Prevent double-registration
        assert!(!vec_map::contains(&registry.duels, &duel_id), EDuelAlreadyRegistered);

        let created_at = sui::clock::timestamp_ms(clock);
        let _ = ctx;

        let meta = DuelMeta {
            duel_id,
            creator,
            entry_amount,
            duration_ms,
            status: 0, // STATUS_OPEN
            created_at,
            creator_blob_id,
        };

        vec_map::insert(&mut registry.duels, duel_id, meta);
        registry.total_created = registry.total_created + 1;

        event::emit(DuelRegistered {
            duel_id,
            creator,
            entry_amount,
        });
    }

    /// Update a duel's status in the registry (called by admin after on-chain status changes).
    public entry fun update_duel_status(
        registry: &mut DuelRegistry,
        duel_id: ID,
        new_status: u8,
        ctx: &TxContext,
    ) {
        assert!(ctx.sender() == registry.admin, ENotAdmin);
        assert!(vec_map::contains(&registry.duels, &duel_id), 2);

        let meta = vec_map::get_mut(&mut registry.duels, &duel_id);
        meta.status = new_status;

        event::emit(DuelStatusUpdated { duel_id, new_status });
    }

    /// Update the platform fee (admin only).
    public entry fun set_platform_fee(
        registry: &mut DuelRegistry,
        new_fee_bps: u64,
        ctx: &TxContext,
    ) {
        assert!(ctx.sender() == registry.admin, ENotAdmin);
        registry.platform_fee_bps = new_fee_bps;
    }

    // ============ View Functions ============

    public fun total_created(registry: &DuelRegistry): u64 {
        registry.total_created
    }

    public fun platform_fee_bps(registry: &DuelRegistry): u64 {
        registry.platform_fee_bps
    }

    public fun duel_count(registry: &DuelRegistry): u64 {
        vec_map::length(&registry.duels)
    }

    public fun is_registered(registry: &DuelRegistry, duel_id: &ID): bool {
        vec_map::contains(&registry.duels, duel_id)
    }

    // ============ Test Helpers ============

    #[test_only]
    public fun init_for_testing(ctx: &mut TxContext) {
        init(ctx);
    }
}
