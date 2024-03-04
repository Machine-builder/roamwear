export function hideLoreString(unhiddenString: string): string {
    return unhiddenString.split('').map(char => `§${char}`).join('');
}

export function unhideLoreString(hiddenString: string): string {
    return hiddenString.split('').filter((char, index) => index % 2 === 1).join('');
}