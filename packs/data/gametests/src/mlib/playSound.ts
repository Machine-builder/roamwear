import { Dimension, Vector3 } from "@minecraft/server";

export function playSound(dimension: Dimension, sound: string, player: string, position: Vector3, volume: number = 1.0, pitch: number = 1.0, minimumVolume: number = 0.0) {
    dimension.runCommand(`playsound ${sound} ${player} ${position.x} ${position.y} ${position.z} ${volume} ${pitch} ${minimumVolume}`);
}