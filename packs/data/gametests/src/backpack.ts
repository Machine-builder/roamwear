

import { Logger } from "@bedrock-oss/bedrock-boost";
import { BlockInventoryComponent, BlockPermutation, Container, Dimension, Entity, EntityEquippableComponent, EntityHealthComponent, EntityInventoryComponent, EntityItemComponent, EquipmentSlot, ItemStack, Player, Vector3, system, world } from "@minecraft/server";
import { structureLoad, structureSave } from "./mlib/structure";
import { createRandomStringId } from "./mlib/random";
import { hideLoreString, unhideLoreString } from "./mlib/loreText";
import { colorNameToIndex } from "./mlib/color";
import { playSound } from "./mlib/playSound";

const moduleLogger = Logger.getLogger("backpack.ts");

const BackpackIdLength = 8;
const BackpackItemIds = [
    "roamwear:backpack",
    "roamwear:backpack_white",
    "roamwear:backpack_orange",
    "roamwear:backpack_magenta",
    "roamwear:backpack_light_blue",
    "roamwear:backpack_yellow",
    "roamwear:backpack_lime",
    "roamwear:backpack_pink",
    "roamwear:backpack_gray",
    "roamwear:backpack_silver",
    "roamwear:backpack_cyan",
    "roamwear:backpack_purple",
    "roamwear:backpack_blue",
    "roamwear:backpack_brown",
    "roamwear:backpack_green",
    "roamwear:backpack_red",
    "roamwear:backpack_black"
];
const SoundPlacement = "armor.equip_leather";
const SoundPickup = "random.pop";

const DisallowedItemsInBackpacks = BackpackItemIds.concat([
    "minecraft:undyed_shulker_box",
    "minecraft:white_shulker_box",
    "minecraft:orange_shulker_box",
    "minecraft:magenta_shulker_box",
    "minecraft:light_blue_shulker_box",
    "minecraft:yellow_shulker_box",
    "minecraft:lime_shulker_box",
    "minecraft:pink_shulker_box",
    "minecraft:gray_shulker_box",
    "minecraft:silver_shulker_box",
    "minecraft:cyan_shulker_box",
    "minecraft:purple_shulker_box",
    "minecraft:blue_shulker_box",
    "minecraft:brown_shulker_box",
    "minecraft:green_shulker_box",
    "minecraft:red_shulker_box",
    "minecraft:black_shulker_box",
])

function getBackpackColorNameFromItemTypeId(backpackTypeId: string) {
    return backpackTypeId.slice(18);
}

function createNewBackpackId(): string {
    return createRandomStringId(BackpackIdLength);
}

function getBackpackId(entity: Entity): string {
    // @ts-ignore
    return entity.getDynamicProperty("roamwear:backpack_id") ?? createNewBackpackId();
}

function setBackpackId(entity: Entity, backpackId: string) {
    entity.setDynamicProperty("roamwear:backpack_id", backpackId);
}

function getBarrelstructureName(backpackId: string): string {
    return `rw:bp_${backpackId}`;
}

function transferAllItems(containerA: Container, containerB: Container) {
    for (let i=0; i<Math.min(containerA.size, containerB.size); i++) {
        containerB.setItem(i, containerA.getItem(i));
        containerA.setItem(i, undefined);
    }
}

function transferAllItemsFiltered(containerA: Container, containerB: Container, blacklist: String[]) {
    for (let i=0; i<Math.min(containerA.size, containerB.size); i++) {
        let itemA = containerA.getItem(i);
        if (blacklist.includes(itemA?.typeId ?? "")) continue;
        containerB.setItem(i, containerA.getItem(i));
        containerA.setItem(i, undefined);
    }
}

function dropAllItems(container: Container, dimension: Dimension, location: Vector3) {
    for (let i=0; i<container.size; i++) {
        const itemStack = container.getItem(i);
        if (itemStack === undefined) continue;
        dimension.spawnItem(itemStack, location);
        container.setItem(i, undefined);
    }
}

// Picking up a backpack should save the inventory to a temporary structure then remove the structure

function pickupBackpack(entity: Entity) {
    const container = entity.getComponent(EntityInventoryComponent.componentId)?.container;
    if (container === undefined) {
        // No container so just drop the item
    } else {
        // Copy the contents into a barrel in a tmp structure
        const backpackId = getBackpackId(entity);

        const entityBlockLocation = {
            x: Math.floor(entity.location.x),
            y: Math.floor(entity.location.y),
            z: Math.floor(entity.location.z)
        };

        // Create a barrel
        const block = entity.dimension.getBlock(entityBlockLocation);
        if (block === undefined) { moduleLogger.fatal("pickupBackpack block was undefined"); return; }

        // Save the block's permutation before we convert it to a barrel
        const blockBeforePermutation = block.permutation;
        block.setPermutation(BlockPermutation.resolve("barrel"));

        // Get the barrel container
        const blockContainer = block.getComponent(BlockInventoryComponent.componentId)?.container;
        if (blockContainer === undefined) { moduleLogger.fatal("pickupBackpack blockContainer was undefined"); return; }

        // Transfer all items from the entity container to the barrel
        transferAllItemsFiltered(container, blockContainer, DisallowedItemsInBackpacks);

        // Drop any items left in the backpack onto the ground
        dropAllItems(container, entity.dimension, entity.location);

        // Count full slots so we can display this stat in the item lore
        let slotsFull = 0;
        let slotsCount = container.size;
        for (let slot=0; slot<container.size; slot++) {
            if (blockContainer.getItem(slot) !== undefined) slotsFull++;
        }

        // Save the structure
        const structureName = getBarrelstructureName(backpackId);
        structureSave({
            name: structureName,
            dimension: entity.dimension,
            from: entityBlockLocation,
            to: entityBlockLocation,
            saveMode: "disk"
        });
        moduleLogger.info(`Saved structure as "${structureName}"`);

        // Empty the barrel items so the items don't appear in the world
        // when we replace the barrel
        blockContainer.clearAll();

        // Set the block back to whatever it was before the barrel
        block.setPermutation(blockBeforePermutation);

        // Get the item typeId from the backpack's colour
        // @ts-ignore
        const color: number = entity.getProperty("roamwear:color") ?? -1;
        let itemTypeId = "roamwear:backpack";
        if (color > -1) {
            const colorName = [ "white", "orange", "magenta", "light_blue", "yellow", "lime", "pink", "gray", "silver", "cyan", "purple", "blue", "brown", "green", "red", "black" ][color];
            itemTypeId = `roamwear:backpack_${colorName}`;
        }

        // Spawn an item with the id in the lore text
        const itemStack = new ItemStack(itemTypeId, 1);
        itemStack.setLore(
            [
                hideLoreString(backpackId),
                `§r${slotsFull} / ${slotsCount} slots`
            ]
        )
        itemStack.nameTag = entity.nameTag.length > 0 ? entity.nameTag : undefined;
        const itemEntity = entity.dimension.spawnItem(
            itemStack,
            entity.location
        );

        // Play a pop sound
        playSound(entity.dimension, SoundPickup, "@a", entity.location);

        // Despawn the entity
        entity.remove();
    }
};

function getBackpackPlacementLocation(player: Player): Vector3 | undefined {
    const hitResult = player.getBlockFromViewDirection({maxDistance: 7});
    if (hitResult !== undefined) {
        return {
            x: hitResult.block.x+hitResult.faceLocation.x,
            y: hitResult.block.y+hitResult.faceLocation.y,
            z: hitResult.block.z+hitResult.faceLocation.z
        }
    } else {
        return undefined;
    }
}

function spawnBackpack(player: Player, itemStack: ItemStack, placementLocation: Vector3) {
    const loreLines = itemStack.getLore();
    let loreFirstLine: string | undefined = loreLines[0];
    
    const entityBlockLocation = {
        x: Math.floor(player.location.x),
        y: Math.floor(player.location.y),
        z: Math.floor(player.location.z)
    };

    // Spawn a backpack entity and copy the inventory from the saved structure based on backpackId

    // Separate out the backpack id from the lore lines, or create a new id if there was none
    let backpackId;
    let hasSavedStructure = false;
    if (loreFirstLine === undefined) {
        backpackId = createNewBackpackId();
    } else {
        backpackId = unhideLoreString(loreFirstLine);
        hasSavedStructure = true;
    }

    // Spawn the backpack entity and set its id property to either the id or undefined
    const entity = player.dimension.spawnEntity("roamwear:backpack", placementLocation);
    const backpackContainer = entity.getComponent(EntityInventoryComponent.componentId)?.container;
    if (backpackContainer === undefined) { moduleLogger.fatal("spawnBackpack backpackContainer was undefined"); return; }
    setBackpackId(entity, backpackId);

    // Set entity rotation
    entity.setRotation({
        x: 0,
        y: player.getRotation().y+180
    });

    // Set entity name if the itemStack has a name
    const itemStackName = itemStack.nameTag;
    if (itemStackName !== undefined) {
        entity.nameTag = itemStackName;
    }

    // Set the entity color property according to the item typeId
    const colorName = getBackpackColorNameFromItemTypeId(itemStack.typeId);
    if (colorName.length > 0) {
        const colorIndex = colorNameToIndex(colorName);
        entity.setProperty("roamwear:color", colorIndex);
    }

    if (hasSavedStructure) {
        // Get the block at the location before loading the structure
        const block = player.dimension.getBlock(entityBlockLocation);
        if (block === undefined) { moduleLogger.fatal("spawnBackpack block was undefined"); return; }
    
        // Save the block's permutation before we convert it to a barrel
        const blockBeforePermutation = block.permutation;

        // Load the structure
        const structureName = getBarrelstructureName(backpackId);
        structureLoad({
            name: structureName,
            dimension: player.dimension,
            to: entityBlockLocation
        });

        // Get the barrel container
        const blockContainer = block.getComponent(BlockInventoryComponent.componentId)?.container;
        if (blockContainer === undefined) { moduleLogger.fatal("spawnBackpack blockContainer was undefined"); return; }

        // Transfer all items from the entity container to the barrel
        transferAllItems(blockContainer, backpackContainer);

        // Reset the block to what it was before the structure overwrote it
        block.setPermutation(blockBeforePermutation);
    }

    // Play a placement sound
    playSound(player.dimension, SoundPlacement, "@a", placementLocation);

    // Clear the player's mainhand
    const equipment = player.getComponent(EntityEquippableComponent.componentId);
    equipment?.setEquipment(EquipmentSlot.Mainhand, undefined);

    moduleLogger.info(`spawnBackpack successfully spawned backpack with id ${backpackId}`);

    return true;
}

system.afterEvents.scriptEventReceive.subscribe(function(data) {
    if (data.id !== "roamwear:pickup") return;
    const entity = data.sourceEntity;
    if (entity === undefined) return;
    pickupBackpack(entity);
})

world.afterEvents.entityHitEntity.subscribe(function(data) {
    if (data.hitEntity.typeId != "roamwear:backpack") return;
    if (data.damagingEntity.typeId != "minecraft:player") return;
    if (!data.damagingEntity.isSneaking) return;
    if ((data.hitEntity.getComponent(EntityHealthComponent.componentId)?.currentValue ?? 0) <= 0) return;
    pickupBackpack(data.hitEntity);
});

world.beforeEvents.itemUse.subscribe(function(data) {
    const player = data.source;
    const itemStack = data.itemStack;
    if (!BackpackItemIds.includes(itemStack?.typeId)) return;
    if (!player.isSneaking) {
        const placementLocation = getBackpackPlacementLocation(player);
        if (placementLocation !== undefined) {
            data.cancel = true;
            moduleLogger.info(`itemUse triggered, player sneaking, and placement found. Spawn a backpack and cancel event`);
            // Place the backpack down
            system.run(() => {
                spawnBackpack(player, itemStack, placementLocation);
            });
        }
    }
});