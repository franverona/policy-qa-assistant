import { chat, embed } from '../src/llm'
import { smoke } from '../src/llm/smoke'

smoke({ chat, embed })
  .then((result) => console.log(result))
  .catch((err) => {
    console.error(err)
    process.exit(1)
  })
