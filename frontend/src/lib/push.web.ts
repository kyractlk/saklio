export async function registerForPush(_userId?: string): Promise<string | null> {
  return null;
}

export function listenToNotificationOpens(_onUrl: (url: string) => void) {
  return { remove() {} };
}
