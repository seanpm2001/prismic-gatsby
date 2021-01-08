import * as RTE from 'fp-ts/ReaderTaskEither'
import { pipe } from 'fp-ts/function'

import { createTypePath } from '../lib/createTypePath'

import { FieldConfigCreator, PrismicFieldType } from '../types'

export const buildSelectFieldConfig: FieldConfigCreator = (path) =>
  pipe(
    createTypePath(path, PrismicFieldType.Select),
    RTE.map(() => 'String'),
  )
