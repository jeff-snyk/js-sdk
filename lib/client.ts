import 'isomorphic-fetch'
import { stringify } from 'qs'
import * as S from 'string'
import * as when from 'ramda/src/when'
import * as not from 'ramda/src/not'
import * as isNil from 'ramda/src/isNil'
import * as compose from 'ramda/src/compose'
import * as ifElse from 'ramda/src/ifElse'
import * as identity from 'ramda/src/identity'
import { Authorizer } from './interfaces'
import hostname from './hostname'

export interface Endpoint {
  base: string;
  action?: string;
  params?: any;
  qs?: any;
}

export interface ClientConfig {
  authorize(request: Function): Promise<any>
}

interface SDKResponse {
  body: any;
  response: any;
  request: any;
}

const notNil = compose(
  not,
  isNil
)

function authValid(response): any {
  if (response.status === 403) {
    throw new Error(`${response.status} ${response.statusText}`)
  } else {
   return response
  }
}

function request(url: string, payload: any, config: RequestInit): Function {
  const headers = new Headers()
  headers.append('Accept', 'application/json')
  headers.append('Content-Type', 'application/json')

  let opts: RequestInit = { mode: 'cors', credentials: 'include', headers, ...config }

  if ((config.method !== 'GET' && config.method !== 'HEAD') && payload) {
    opts.body = JSON.stringify(payload)
  }

  return function authorizedRequest([authKey, authValue]: Array<string>): Promise<SDKResponse> {
    headers.append(authKey, authValue)

    const request = fetch(url, opts)

    return request
      .then(authValid)
      .then((response) => new Promise((res, rej) => {
        return response
          .json()
          .then((body) => {
            res({ body, request, response })
          })
          .catch(rej);
      }))
  }
}

export class Client {
  private readonly host: string;
  private authorize: any;
  private fetchConfig: RequestInit;

  constructor(authorizer: Authorizer, config: RequestInit = {}, host: string = hostname) {
    this.authorize = authorizer.authorize
    this.host = host
    this.fetchConfig = config
  }

  public get = (endpoint: Endpoint): Promise<any> =>
    this.authorize(request(this.url(endpoint), null, { method: 'GET', ...this.fetchConfig }))

  public post = (endpoint: Endpoint, payload: any): Promise<any> =>
    this.authorize(request(this.url(endpoint), payload, { method: 'POST', ...this.fetchConfig }))

  public patch = (endpoint: Endpoint, payload: any): Promise<any> =>
    this.authorize(request(this.url(endpoint), payload, { method: 'PATCH', ...this.fetchConfig }))

  public destroy = (endpoint: Endpoint): Promise<any> =>
    this.authorize(request(this.url(endpoint), null, { method: 'DESTROY', ...this.fetchConfig }))

  private url = ({ base, action, params = {}, qs }: Endpoint): string => compose(
    when(
      () => notNil(qs),
      finalUrl => `${finalUrl}?${stringify(qs)}`
    ),
    when(
      () => notNil(action),
      resourceUrl => `${resourceUrl}/${action}`
    ),
    when(
      () => notNil(params.id),
      collectionUrl => `${collectionUrl}/${params.id}`
    ),
    hostname => `${hostname}${S(base).template(params, '{', '}').s}`
  )(this.host)

}

function client(authorizer: Authorizer, config: RequestInit = {}, host: string = hostname) {
  return new Client(authorizer, config, host)
}

export default client
