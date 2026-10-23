import { handleTts } from './_ai-core.mjs'

export default async function handler(req, res) {
  await handleTts(req, res)
}
