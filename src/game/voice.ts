export interface VoiceProfile {
  id: string
  label: string
  sample: string
}

export const IDENTITY_VOICES: Record<string, VoiceProfile> = {
  student: {
    id: 'male-qn-daxuesheng',
    label: '清亮男声',
    sample: '/audio/voices/student.mp3',
  },
  newcomer: {
    id: 'female-chengshu',
    label: '温柔女声',
    sample: '/audio/voices/newcomer.mp3',
  },
  freelancer: {
    id: 'male-qn-qingse',
    label: '松弛男声',
    sample: '/audio/voices/freelancer.mp3',
  },
  researcher: {
    id: 'chunzhen_xuedi',
    label: '认真女声',
    sample: '/audio/voices/researcher.mp3',
  },
}

export const PET_VOICE: VoiceProfile = {
  id: 'cute_boy',
  label: '小鲸',
  sample: '/audio/voices/pet.mp3',
}

export function identityVoice(identityId: string): VoiceProfile {
  return IDENTITY_VOICES[identityId] ?? IDENTITY_VOICES.student
}
