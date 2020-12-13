import * as RTE from 'fp-ts/ReaderTaskEither'
import { pipe } from 'fp-ts/function'

import { Dependencies } from '../types'
import { REPORTER_TEMPLATE } from '../constants'
import { sprintf } from './sprintf'

export const reportInfo = (
  text: string,
): RTE.ReaderTaskEither<Dependencies, never, void> =>
  RTE.asks((deps) =>
    pipe(
      sprintf(REPORTER_TEMPLATE, deps.pluginOptions.repositoryName, text),
      deps.reportInfo,
    ),
  )
