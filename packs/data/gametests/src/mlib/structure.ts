import { Dimension, Vector3, world } from "@minecraft/server";

type StructureSaveMode = "disk" | "memory";
type StructureRotation = "0_degrees" | "90_degrees" | "180_degrees" | "270_degrees";
type StructureMirror = "none" | "x" | "xz" | "z";

interface StructureSaveOptions {
    dimension: Dimension,
    name: string,
    from: Vector3,
    to: Vector3,
    includesEntities?: boolean,
    saveMode: StructureSaveMode,
    includesBlocks?: boolean,
}

interface StructureLoadOptions {
    dimension: Dimension,
    name: string,
    to: Vector3,
    rotation?: StructureRotation,
    mirror?: StructureMirror,
    includesEntities?: boolean,
    includesBlocks?: boolean,
    waterlogged?: boolean,
    integrity?: number,
    seed?: string
}

function structureSave(options: StructureSaveOptions) {
    options.dimension.runCommand(`
        structure save
        ${options.name}
        ${options.from.x} ${options.from.y} ${options.from.z}
        ${options.to.x} ${options.to.y} ${options.to.z}
        ${options.includesEntities ?? false}
        ${options.saveMode}
        ${options.includesBlocks ?? true}`);
}

function structureLoad(options: StructureLoadOptions) {
    options.dimension.runCommand(`
        structure load
        ${options.name}
        ${options.to.x} ${options.to.y} ${options.to.z}
        ${options.rotation ?? "0_degrees"}
        ${options.mirror ?? "none"}
        ${options.includesEntities ?? true}
        ${options.includesBlocks ?? true}
        ${options.waterlogged ?? false}
        ${options.integrity ?? 100.0}
        ${options.seed ?? ""}`);
}

export { structureSave, structureLoad }