// The conditional Saturday crash reuses stills from the same moments instead of
// shipping a second set of art that most players will never see.
const IMAGE_ALIASES: Record<string, string> = {
  'd6-crash-rest': 'd6-body-sleep',
  'd6-crash-push': 'd1-morning-work',
  'd6-crash-help': 'd4-stuck-ask',
}

function imageId(choiceId: string): string {
  return IMAGE_ALIASES[choiceId] ?? choiceId
}

export function choiceImageKey(choiceId: string): string {
  return `/images/choices/${imageId(choiceId)}.webp`
}

export function choiceThumbKey(choiceId: string): string {
  return `/images/choices/thumbs/${imageId(choiceId)}.webp`
}

export function endingImageKey(endingId: string): string {
  return `/images/endings/${endingId}.webp`
}
