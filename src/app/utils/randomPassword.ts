import crypto from 'crypto';
export default function generateRandomPassword(length = 10){
    if (length < 8) {
        throw new Error("Password length should be at least 8 characters.");
    }

    const lower = 'abcdefghijklmnopqrstuvwxyz';
    const upper = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const numbers = '0123456789';
    const special = '!@#$%^&*()_+[]{}|;:",.<>?';
    const all = lower + upper + numbers + special;
    const pick = (chars: string) => chars[crypto.randomInt(chars.length)];

    const chars = [pick(lower), pick(upper), pick(numbers), pick(special)];
    for(let i = chars.length; i < length; i++) {
        chars.push(pick(all));
    }

    for(let i = chars.length - 1; i > 0; i--) {
        const j = crypto.randomInt(i + 1);
        [chars[i], chars[j]] = [chars[j], chars[i]];
    }

    return chars.join('');
}