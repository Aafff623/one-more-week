const STREAK_LINES = {
  care: '你已经连着几次把时间让给别人了。照顾不是错，但别忘了也给自己留一口气。',
  focus: '专注已经变成你这周的主旋律了。身体不是永动机，别把休息当成失败。',
  rest: '你很会给自己留白。只是别让所有难事都自动推到下周。',
  connect: '你在把关系一点点接回来。它们不会立刻变好，但会记住你来过。',
  risk: '你这次绕开了。绕开也会变成习惯，下一周再看看它还在不在。',
}

const LOWEST_LINES = {
  energy: '精力已经有点见底了。今天剩下的时间，真的要全部交出去吗？',
  mood: '你看起来在把事情做完，但心情一直没跟上。要不要给自己留一个没有产出的晚上？',
  relationships: '你这一周很会安排事情，只是关系不会自己排队等你。',
  growth: '日子过得不算差，只是你有没有发现，自己一直在原地打转？',
}

const TONE_LINES = {
  care: '你又在先照顾别人。记得把“我自己”也算进需要照顾的名单里。',
  focus: '你把注意力交出去了，进度会记住，身体也会记住。',
  rest: '休息不是偷懒，但休息也会变成一种惯性。明天再看看你想往哪边走。',
  connect: '你愿意多停一会儿听别人说话，这种时刻通常不会出现在待办清单里。',
  risk: '这次你没有正面接住它。逃开不丢人，只是别假装它没有发生。',
}

const DEFAULT_LINE = '我在旁边看着呢。你不必每一格都填满，也不必每一格都解释。'

export function localPetComment(payload = {}) {
  const tone = payload.tone
  const streak = Number(payload.toneStreak) || 0
  if (streak >= 3 && tone && STREAK_LINES[tone]) return STREAK_LINES[tone]
  if (payload.lowestStat && LOWEST_LINES[payload.lowestStat]) return LOWEST_LINES[payload.lowestStat]
  if (tone && TONE_LINES[tone]) return TONE_LINES[tone]
  return DEFAULT_LINE
}

export function lowestStat(stats = {}) {
  return ['energy', 'mood', 'growth', 'relationships'].reduce((lowest, key) =>
    (stats[key] ?? 100) < (stats[lowest] ?? 100) ? key : lowest,
  )
}
