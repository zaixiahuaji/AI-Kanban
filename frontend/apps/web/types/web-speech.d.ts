// Web Speech API 类型声明（实验性，TS 内置 lib.dom 未包含）
// 仅用于满足类型检查，运行时由浏览器提供

interface SpeechRecognitionResultItem {
  transcript: string
}

interface SpeechRecognitionResult {
  readonly length: number
  isFinal: boolean
  [index: number]: SpeechRecognitionResultItem
}

interface SpeechRecognitionResultList {
  readonly length: number
  [index: number]: SpeechRecognitionResult
}

interface SpeechRecognitionEvent extends Event {
  resultIndex: number
  results: SpeechRecognitionResultList
}

interface SpeechRecognitionErrorEvent extends Event {
  error: string
}

interface ISpeechRecognition {
  interimResults: boolean
  continuous: boolean
  profanityFilter: boolean
  onresult: ((event: SpeechRecognitionEvent) => void) | null
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null
  onend: (() => void) | null
  start(): void
  stop(): void
  abort(): void
}

interface SpeechRecognition {
  new (): ISpeechRecognition
  prototype: ISpeechRecognition
}

interface Window {
  SpeechRecognition?: SpeechRecognition
  webkitSpeechRecognition?: SpeechRecognition
}
