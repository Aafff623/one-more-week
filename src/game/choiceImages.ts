export function choiceImageKey(choiceId: string): string {
  return `/images/choices/${choiceId}.webp`
}

export function choiceThumbKey(choiceId: string): string {
  return `/images/choices/thumbs/${choiceId}.webp`
}

export function endingImageKey(endingId: string): string {
  return `/images/endings/${endingId}.webp`
}
