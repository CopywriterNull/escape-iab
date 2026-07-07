export type MemberRole = "owner" | "member" | "viewer";

const ROLE_RANK: Record<MemberRole, number> = { viewer: 0, member: 1, owner: 2 };

/** True when `role` grants at least `min`'s capabilities (owner > member > viewer). */
export function roleAtLeast(role: MemberRole | null, min: MemberRole): boolean {
  return role != null && ROLE_RANK[role] >= ROLE_RANK[min];
}
