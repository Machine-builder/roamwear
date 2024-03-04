const Colors = [ "white", "orange", "magenta", "light_blue", "yellow", "lime", "pink", "gray", "silver", "cyan", "purple", "blue", "brown", "green", "red", "black" ]
export function colorNameToIndex(colorName: string) {
    return Colors.indexOf(colorName);
}
export function indexToColorName(index: number) {
    return Colors[index];
}