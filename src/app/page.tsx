import { Chat } from './chat'

export default function Home() {
  return (
    <main className="mx-auto max-w-6xl p-8">
      <h1 className="text-2xl font-semibold">Policy Q&amp;A Assistant</h1>
      <p className="mt-2 text-gray-600">
        Answers come only from Harborline Mutual policies and the internal wiki, with a source for
        every sentence. If the sources don&apos;t cover it, the assistant says so.
      </p>
      <Chat />
    </main>
  )
}
