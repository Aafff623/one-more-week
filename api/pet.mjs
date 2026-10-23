import { handlePet } from './_ai-core.mjs'

export default async function handler(req, res) {
  await handlePet(req, res)
}
