export interface PetProvider {
  name: string
  comment(payload: Record<string, unknown>): Promise<string> | string
}

export interface PetProviderReply {
  text: string
  provider: string
  degraded?: boolean
}

export function requestPetReply(
  payload: Record<string, unknown>,
  providers: PetProvider[],
  fallback: (payload: Record<string, unknown>) => string,
): Promise<PetProviderReply>
