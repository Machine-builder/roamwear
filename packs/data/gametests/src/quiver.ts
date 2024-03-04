import { Logger } from "@bedrock-oss/bedrock-boost";
import { Container, EntityInventoryComponent, ItemStack, Player, system, world } from "@minecraft/server";

const moduleLogger = Logger.getLogger("quiver.ts");

type ItemStackAndSlot = {
    itemStack: ItemStack,
    slot: number
}

function getQuiverItem(container: Container): ItemStackAndSlot | undefined {
    for (let checkSlot of [8, 17, 20]) {
        if (checkSlot >= container.size) continue;
        const itemStack = container.getItem(checkSlot);
        moduleLogger.debug(itemStack?.typeId);
        if (itemStack?.typeId == "roamwear:quiver") return {
            itemStack: itemStack,
            slot: checkSlot
        };
    };
    return undefined;
}

function updatePlayerQuiver(player: Player) {
    if (!player.isValid()) {
        moduleLogger.fatal("Player is not valid");
        return;
    };

    const container = player.getComponent(EntityInventoryComponent.componentId)?.container;
    if (container === undefined) {
        moduleLogger.fatal("Player container is undefined");
        return;
    }

    // Get the quiver item and which slot it was in
    const quiver = getQuiverItem(container);
    if (quiver === undefined) return;

    world.sendMessage(String(quiver.slot));
}

system.runInterval(function() {
    for (const player of world.getAllPlayers()) {
        updatePlayerQuiver(player);
    }
}, 20);