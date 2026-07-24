export function getChatRoomId(user1: string, user2: string): string {
  const sorted = [user1.toLowerCase(), user2.toLowerCase()].sort();
  return `${sorted[0]}_${sorted[1]}`;
}