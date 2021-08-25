import * as prismicT from '@prismicio/types'
import * as prismicH from '@prismicio/helpers'
import * as imgixGatsby from '@imgix/gatsby'
import * as nodeHelpers from 'gatsby-node-helpers'
import md5 from 'tiny-hashes/md5'

import { TransformFieldNameFn, TypePath } from '../types'
import { normalize } from './normalize'
import {
  DEFAULT_IMGIX_PARAMS,
  DEFAULT_PLACEHOLDER_IMGIX_PARAMS,
  GLOBAL_TYPE_PREFIX,
} from '../constants'
import { NormalizedValue } from './types'
import { SetRequired } from 'type-fest'
import {
  customTypeModelToTypePaths,
  sharedSliceModelToTypePaths,
} from './typePaths'
import { NormalizedDocumentValue } from './normalizers'

const createNodeId = (input: string): string => md5(input)
const createContentDigest = <T>(input: T): string => md5(JSON.stringify(input))

export type RuntimeConfig = {
  typePrefix?: string
  linkResolver?: prismicH.LinkResolverFunction
  imageImgixParams?: imgixGatsby.ImgixUrlParams
  imagePlaceholderImgixParams?: imgixGatsby.ImgixUrlParams
  htmlSerializer?: prismicH.HTMLMapSerializer | prismicH.HTMLFunctionSerializer
  transformFieldName?: TransformFieldNameFn
}

type SubscriberFn = () => void

export const createRuntime = (config: RuntimeConfig = {}): Runtime => {
  return new Runtime(config)
}

export class Runtime {
  nodes: NormalizedDocumentValue[]
  typePaths: TypePath[]
  subscribers: SubscriberFn[]

  config: SetRequired<
    RuntimeConfig,
    'imageImgixParams' | 'imagePlaceholderImgixParams' | 'transformFieldName'
  >

  nodeHelpers: nodeHelpers.NodeHelpers

  constructor(config: RuntimeConfig = {}) {
    this.nodes = []
    this.typePaths = []
    this.subscribers = []

    this.config = {
      ...config,
      imageImgixParams: config.imageImgixParams ?? DEFAULT_IMGIX_PARAMS,
      imagePlaceholderImgixParams:
        config.imagePlaceholderImgixParams ?? DEFAULT_PLACEHOLDER_IMGIX_PARAMS,
      transformFieldName:
        config.transformFieldName ??
        ((fieldName: string) => fieldName.replace(/-/g, '_')),
    }

    this.nodeHelpers = nodeHelpers.createNodeHelpers({
      typePrefix: [GLOBAL_TYPE_PREFIX, config.typePrefix]
        .filter(Boolean)
        .join(' '),
      fieldPrefix: GLOBAL_TYPE_PREFIX,
      createNodeId,
      createContentDigest,
    })
  }

  subscribe(callback: SubscriberFn): void {
    this.subscribers = [...this.subscribers, callback]
  }

  unsubscribe(callback: SubscriberFn): void {
    this.subscribers = this.subscribers.filter(
      (registeredCallback) => registeredCallback !== callback,
    )
  }

  registerCustomTypeModel(model: prismicT.CustomTypeModel): TypePath[] {
    const typePaths = customTypeModelToTypePaths(
      model,
      this.config.transformFieldName,
    )

    this.typePaths = [...this.typePaths, ...typePaths]

    this.#notifySubscribers()

    return typePaths
  }

  registerCustomTypeModels(models: prismicT.CustomTypeModel[]): TypePath[] {
    const typePaths = models.flatMap((model) =>
      customTypeModelToTypePaths(model, this.config.transformFieldName),
    )

    this.typePaths = [...this.typePaths, ...typePaths]

    this.#notifySubscribers()

    return typePaths
  }

  registerSharedSliceModel(model: prismicT.SharedSliceModel): TypePath[] {
    const typePaths = sharedSliceModelToTypePaths(
      model,
      this.config.transformFieldName,
    )

    this.typePaths = [...this.typePaths, ...typePaths]

    this.#notifySubscribers()

    return typePaths
  }

  registerSharedSliceModels(models: prismicT.SharedSliceModel[]): TypePath[] {
    const typePaths = models.flatMap((model) =>
      sharedSliceModelToTypePaths(model, this.config.transformFieldName),
    )

    this.typePaths = [...this.typePaths, ...typePaths]

    this.#notifySubscribers()

    return typePaths
  }

  registerTypePaths(typePaths: TypePath[]): void {
    this.typePaths = [...this.typePaths, ...typePaths]

    this.#notifySubscribers()
  }

  registerDocument<PrismicDocument extends prismicT.PrismicDocument>(
    document: PrismicDocument,
  ): NormalizedDocumentValue<PrismicDocument> {
    const normalizedDocument = this.normalizeDocument(document)

    this.nodes = [...this.nodes, normalizedDocument]

    this.#notifySubscribers()

    return normalizedDocument
  }

  registerDocuments<PrismicDocument extends prismicT.PrismicDocument>(
    documents: PrismicDocument[],
  ): NormalizedDocumentValue<PrismicDocument>[] {
    const nodes = documents.map((document) => {
      return this.normalizeDocument(document)
    })

    this.nodes = [...this.nodes, ...nodes]

    this.#notifySubscribers()

    return nodes
  }

  normalizeDocument<PrismicDocument extends prismicT.PrismicDocument>(
    document: PrismicDocument,
  ): NormalizedDocumentValue<PrismicDocument> {
    return this.normalize(document, [
      document.type,
    ]) as NormalizedDocumentValue<PrismicDocument>
  }

  normalize<Value>(value: Value, path: string[]): NormalizedValue<Value> {
    return normalize({
      value,
      path,
      getNode: this.getNode.bind(this),
      getTypePath: this.getTypePath.bind(this),
      nodeHelpers: this.nodeHelpers,
      linkResolver: this.config.linkResolver,
      htmlSerializer: this.config.htmlSerializer,
      imageImgixParams: this.config.imageImgixParams,
      imagePlaceholderImgixParams: this.config.imagePlaceholderImgixParams,
      transformFieldName: this.config.transformFieldName,
    })
  }

  getNode<Document extends prismicT.PrismicDocument>(
    id: string,
  ): NormalizedDocumentValue<Document> | undefined {
    return this.nodes.find(
      (node): node is NormalizedDocumentValue<Document> =>
        node.prismicId === id,
    )
  }

  hasNode(id: string): boolean {
    return this.nodes.some((node) => node.prismicId === id)
  }

  getTypePath(path: string[]): TypePath | undefined {
    return this.typePaths.find(
      (typePath) =>
        typePath.path.join('__SEPARATOR__') === path.join('__SEPARATOR__'),
    )
  }

  #notifySubscribers(): void {
    for (const subscriber of this.subscribers) {
      subscriber()
    }
  }
}
