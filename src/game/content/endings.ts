import type { EndingDefinition } from '../models'

export const endings: EndingDefinition[] = [
  {
    id: 'burned-out',
    title: '透支的赶路人',
    english: 'The Persistent Builder',
    icon: '↗',
    accent: 'coral',
    description:
      '你为重要的事情付出了很多，也确实往前走了。只是这一周的尾声里，身体已经在提醒你：下一段路需要换一种走法。',
    reflection:
      '努力本身没有错。错的是把恢复当成奖励，而不是继续走路的一部分。',
    conditions: [
      { type: 'stat', key: 'energy', max: 35, label: '精力被压到了很低的水平' },
      { type: 'stat', key: 'growth', min: 60, label: '你确实为目标付出了很多' },
    ],
  },
  {
    id: 'balanced',
    title: '平衡生活者',
    english: 'The Balanced Explorer',
    icon: '◉',
    accent: 'cyan',
    description:
      '你尝试在投入与休息之间找到自己的节奏。精力、心情、关系和成长都没有被完全牺牲，生活不只围绕待办清单转动。',
    reflection:
      '平衡不是把每一格都填满，而是知道什么时候该往前，什么时候该停下来。',
    conditions: [
      { type: 'stat', key: 'energy', min: 50, max: 90, label: '你给恢复留出了位置' },
      { type: 'stat', key: 'mood', min: 60, max: 90, label: '心情保持在可呼吸的范围' },
      { type: 'stat', key: 'relationships', min: 55, max: 90, label: '关系没有被完全挤到角落' },
      { type: 'stat', key: 'growth', min: 55, max: 90, label: '你也推进了对自己重要的事' },
    ],
  },
  {
    id: 'connector',
    title: '关系的守护者',
    english: 'The Connector',
    icon: '♡',
    accent: 'purple',
    description:
      '你愿意把时间留给重要的人，也看见了关系如何成为生活的支撑。你没有把所有事都做完，但有人和你一起记得这一周。',
    reflection:
      '关系不是待办清单上的项目，它会在你愿意停下来的时候，慢慢长出重量。',
    conditions: [
      { type: 'stat', key: 'relationships', min: 75, label: '关系被你放在了重要的位置' },
      { type: 'stat', key: 'mood', min: 60, label: '心情没有被一路赶路消耗掉' },
    ],
  },
  {
    id: 'explorer',
    title: '持续探索者',
    english: 'The Explorer',
    icon: '✳',
    accent: 'lime',
    description:
      '你持续把好奇心变成行动，在解决问题和尝试新事物的过程里积累了能力。这一周没有给你所有答案，但给了你下一段路的工具。',
    reflection:
      '成长不一定发生在最努力的那一天，有时发生在你愿意换个问法的时候。',
    conditions: [{ type: 'stat', key: 'growth', min: 75, label: '你把不少时间交给了学习和尝试' }],
  },
  {
    id: 'week-keeper',
    title: '认真生活的人',
    english: 'The Week Keeper',
    icon: '☼',
    accent: 'lime',
    description:
      '你没有找到所有答案，也没有把每一件事都做到最好。但你开始更清楚地看见自己的取舍，并愿意为它们负责。',
    reflection:
      '不是每一周都需要一个漂亮的结论。有些一周，只是让你更接近自己。',
    conditions: [],
    fallback: true,
  },
]
