// Supabase Auth is email-keyed, but investors sign in with a plain username.
// We map one to the other with a fixed internal domain so the login form and
// any user-creation script agree on the exact address. Not a real mailbox —
// email confirmation is off for these accounts.
const USERNAME_DOMAIN = "birdog.app";

export function usernameToEmail(username: string): string {
  const clean = username.trim().toLowerCase();
  // If someone types a full email, respect it; otherwise synthesize one.
  return clean.includes("@") ? clean : `${clean}@${USERNAME_DOMAIN}`;
}
