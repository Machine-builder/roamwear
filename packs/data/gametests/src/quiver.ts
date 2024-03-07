import { Logger } from "@bedrock-oss/bedrock-boost";
import { Container, EntityInventoryComponent, ItemStack, Player, system, world } from "@minecraft/server";
import { hideLoreString, unhideLoreString } from "./mlib/loreText";

const moduleLogger = Logger.getLogger("quiver.ts");

const QuiverMaxArrowCount = 256;
const MaintainArrowsInInventory = 16;

type ItemStackAndSlot = {
    itemStack: ItemStack,
    slot: number
}

type ItemStackAndSlotOrUndefined = {
    itemStack: ItemStack | undefined,
    slot: number
}

function findItemSlot(container: Container,
                      checkSlots: number[],
                      matchFunction: (itemStack:ItemStack | undefined) => boolean
                      ): ItemStackAndSlotOrUndefined | undefined {
    for (let checkSlot of checkSlots) {
        if (checkSlot >= container.size) continue;
        const itemStack = container.getItem(checkSlot);
        if (matchFunction(itemStack)) {
            return {
                itemStack: itemStack,
                slot: checkSlot
            };
        }
    };
    return;
}

function getQuiverAndArrowItem(container: Container): {quiverSlot: ItemStackAndSlot, arrowSlot: ItemStackAndSlotOrUndefined} | undefined {
    // @ts-ignore
    let quiverSlot: ItemStackAndSlot = findItemSlot(
        container,
        [17, 26, 35, 8], 
        (itemStack) => itemStack?.typeId == "roamwear:quiver");
    if (quiverSlot === undefined) return undefined;
    
    let arrowSlotNotUndefined = findItemSlot(
        container,
        [17, 26, 35, 8], 
        (itemStack) => itemStack?.typeId == "minecraft:arrow");
    let arrowSlotUndefined = findItemSlot(
        container,
        [17, 26, 35, 8], 
        (itemStack) => itemStack === undefined);
    if (arrowSlotNotUndefined === undefined && arrowSlotUndefined === undefined) return undefined;
    
    let arrowSlot;
    if (arrowSlotNotUndefined !== undefined) {
        arrowSlot = arrowSlotNotUndefined;
    } else {
        arrowSlot = arrowSlotUndefined;
    }

    return {
        quiverSlot: quiverSlot,
        // @ts-ignore
        arrowSlot: arrowSlot
    };
}

function getQuiverArrowCount(quiver: ItemStack): number {
    const loreLines = quiver.getLore();
    let loreFirstLine: string | undefined = loreLines[0];
    if (loreFirstLine === undefined) {
        return 0;
    } else {
        return parseInt(unhideLoreString(loreFirstLine));
    }
}

function setQuiverArrowCount(quiver: ItemStack, amount: number) {
    quiver.setLore(
        [
            hideLoreString(amount.toString()),
            `§r${amount} / ${QuiverMaxArrowCount} Arrows`
        ]
    )
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
    const itemSlotResults = getQuiverAndArrowItem(container);
    if (itemSlotResults === undefined) return;

    const itemStackQuiver = itemSlotResults.quiverSlot.itemStack;
    const itemStackArrows = itemSlotResults.arrowSlot.itemStack;

    let updateItemStacks = false;

    // Figure out where to put arrows. They can go anywhere in the top row of the inventory.
    // If an inventory slot is empty, or is arrows, that slot is selected as the arrow slot.

    // If slot arrows is less than 8: Take remaining arrows out of quiver, and add to slot.
    // If slot arrows is more than 8: Take extra arrows out of slot, and put in quiver (to max quiver amount).

    let arrowsCount = itemStackArrows?.amount ?? 0;
    let arrowsInQuiver = getQuiverArrowCount(itemSlotResults.quiverSlot.itemStack);

    if (arrowsCount < MaintainArrowsInInventory && arrowsInQuiver > 0) {
        const additionalArrows = Math.min(MaintainArrowsInInventory-arrowsCount, arrowsInQuiver);
        arrowsCount += additionalArrows;
        arrowsInQuiver -= additionalArrows;
        updateItemStacks = true;

        player.onScreenDisplay.setActionBar(`-${additionalArrows} Arrow(s) (${arrowsInQuiver} / ${QuiverMaxArrowCount})`);

    } else if (arrowsCount > MaintainArrowsInInventory && arrowsInQuiver < QuiverMaxArrowCount) {
        const putArrowsInQuiver = Math.min(QuiverMaxArrowCount-arrowsInQuiver, arrowsCount-MaintainArrowsInInventory);
        arrowsCount -= putArrowsInQuiver;
        arrowsInQuiver += putArrowsInQuiver;
        updateItemStacks = true;

        player.onScreenDisplay.setActionBar(`+${putArrowsInQuiver} Arrow(s) (${arrowsInQuiver} / ${QuiverMaxArrowCount})`);
    }
    
    if (updateItemStacks) {
        // Update quiver arrow count and set quiver item into slot
        setQuiverArrowCount(itemStackQuiver, arrowsInQuiver);
        container.setItem(itemSlotResults.quiverSlot.slot, itemStackQuiver);

        // Update arrow count and set into slot
        if (itemStackArrows === undefined) {
            container.setItem(itemSlotResults.arrowSlot.slot, new ItemStack("arrow", arrowsCount));
        } else {
            itemStackArrows.amount = arrowsCount;
            container.setItem(itemSlotResults.arrowSlot.slot, itemStackArrows);
        }
    }
}

system.runInterval(function() {
    for (const player of world.getAllPlayers()) {
        updatePlayerQuiver(player);
    }
}, 20);