/// IndexRegistry: Maintains a registry of supported assets and their Pyth price feed IDs.
/// This is an admin-controlled shared object that maps token symbols to price feed identifiers
/// and optional tier classifications.
module sui_index::index_registry {
    use std::string::String;
    use sui::vec_map::{Self, VecMap};
    use sui::event;

    // ============ Error Constants ============

    const ENotAdmin: u64 = 0;
    const EAssetAlreadyExists: u64 = 1;
    const EAssetNotFound: u64 = 2;
    const EInvalidTier: u64 = 3;

    // ============ Structs ============

    /// Shared object storing all supported assets.
    public struct Registry has key {
        id: UID,
        /// Admin address that can modify the registry.
        admin: address,
        /// Maps token symbol (e.g. "BTC") to its Pyth price feed ID (hex string).
        assets: VecMap<String, AssetInfo>,
    }

    /// Information about a registered asset.
    public struct AssetInfo has store, copy, drop {
        /// Pyth price feed ID as a hex string.
        pyth_feed_id: String,
        /// Asset tier: 1 = Large Cap, 2 = Mid Cap, 3 = Small Cap
        tier: u8,
        /// Whether this asset is currently active for new duels.
        active: bool,
    }

    // ============ Events ============

    public struct AssetAdded has copy, drop {
        symbol: String,
        pyth_feed_id: String,
        tier: u8,
    }

    public struct AssetRemoved has copy, drop {
        symbol: String,
    }

    public struct AssetUpdated has copy, drop {
        symbol: String,
        active: bool,
    }

    // ============ Init ============

    /// Creates the Registry shared object on module publish.
    fun init(ctx: &mut TxContext) {
        let registry = Registry {
            id: object::new(ctx),
            admin: ctx.sender(),
            assets: vec_map::empty(),
        };
        transfer::share_object(registry);
    }

    // ============ Admin Functions ============

    /// Add a new asset to the registry.
    public entry fun add_asset(
        registry: &mut Registry,
        symbol: String,
        pyth_feed_id: String,
        tier: u8,
        ctx: &TxContext,
    ) {
        assert!(ctx.sender() == registry.admin, ENotAdmin);
        assert!(!vec_map::contains(&registry.assets, &symbol), EAssetAlreadyExists);
        assert!(tier >= 1 && tier <= 3, EInvalidTier);

        let info = AssetInfo {
            pyth_feed_id,
            tier,
            active: true,
        };
        vec_map::insert(&mut registry.assets, symbol, info);

        event::emit(AssetAdded {
            symbol,
            pyth_feed_id,
            tier,
        });
    }

    /// Remove an asset from the registry.
    public entry fun remove_asset(
        registry: &mut Registry,
        symbol: String,
        ctx: &TxContext,
    ) {
        assert!(ctx.sender() == registry.admin, ENotAdmin);
        assert!(vec_map::contains(&registry.assets, &symbol), EAssetNotFound);

        vec_map::remove(&mut registry.assets, &symbol);

        event::emit(AssetRemoved { symbol });
    }

    /// Toggle an asset's active status.
    public entry fun set_asset_active(
        registry: &mut Registry,
        symbol: String,
        active: bool,
        ctx: &TxContext,
    ) {
        assert!(ctx.sender() == registry.admin, ENotAdmin);
        assert!(vec_map::contains(&registry.assets, &symbol), EAssetNotFound);

        let info = vec_map::get_mut(&mut registry.assets, &symbol);
        info.active = active;

        event::emit(AssetUpdated { symbol, active });
    }

    // ============ View Functions ============

    /// Check if an asset symbol is registered and active.
    public fun is_active_asset(registry: &Registry, symbol: &String): bool {
        if (!vec_map::contains(&registry.assets, symbol)) {
            return false
        };
        let info = vec_map::get(&registry.assets, symbol);
        info.active
    }

    /// Get the Pyth feed ID for a symbol.
    public fun get_feed_id(registry: &Registry, symbol: &String): String {
        let info = vec_map::get(&registry.assets, symbol);
        info.pyth_feed_id
    }

    /// Get the number of registered assets.
    public fun asset_count(registry: &Registry): u64 {
        vec_map::length(&registry.assets)
    }

    // ============ Test Helpers ============

    #[test_only]
    public fun init_for_testing(ctx: &mut TxContext) {
        init(ctx);
    }
}
