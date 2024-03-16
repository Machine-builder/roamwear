import { GameMode, Player } from "@minecraft/server";

export function isGamemode(player: Player, gamemode: GameMode) {
    return player.matches({gameMode: gamemode});
}