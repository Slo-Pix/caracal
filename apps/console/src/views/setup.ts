// Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
// Caracal, a product of Garudex Labs
//
// Guided first setup workflow for production-shaped Caracal onboarding.

import type { Application, PolicyVersion, Provider, ProviderKind, Resource, ResourceInput, Zone } from '@caracalai/admin'
import type { JsonObject } from '@caracalai/core'
import { DEFAULT_CONTROL_AUDIENCE, generateClientSecret } from '@caracalai/engine'
import {
  DEFAULT_COORDINATOR_URL,
  DEFAULT_ZONE_URL,
  defaultRuntimeConfigPath,
} from '@caracalai/engine/runtime-config'
import { access, chmod, mkdir, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { sanitizeAnsi, truncate, ui } from '../ansi.ts'
import type { Key } from '../keys.ts'
import { maskSecretField, scrubTokens } from '../errors.ts'
import type { App, View, ViewContext } from '../screen.ts'
import { DetailView } from './detail.ts'
import { FormView } from './form.ts'
import { infoPage, openInfo } from './info.ts'
import { EntityPickerView } from './picker.ts'
import type { Ctx } from './factory.ts'

const DEFAULT_GATEWAY_URL = 'http://localhost:8081'
const PROVIDER_KINDS: ProviderKind[] = ['oauth2', 'oidc', 'apikey', 'workload']
const BRACKETED_PASTE_PATTERN = /\u001b\[(?:200|201)~/g
const ANSI_SEQUENCE_PATTERN = /\u001b\[[0-9;?]*[A-Za-z~]/g
const NAMED_KEYS = new Set([
  'up',
  'down',
  'left',
  'right',
  'enter',
  'esc',
  'tab',
  'backspace',
  'pgup',
  'pgdn',
  'home',
  'end',
  'ctrl-c',
])

interface SetupValues {
  selected_zone_id?: string
  zone_name?: string
  selected_agent_app_id?: string
  agent_app_name?: string
  existing_app_client_secret?: string
  selected_resource_id?: string
  resource_identifier?: string
  resource_name?: string
  resource_scopes?: string
  upstream_url?: string
  request_path?: string
  advanced_options?: string
  selected_provider_id?: string
  provider_name?: string
  provider_identifier?: string
  provider_kind?: string
  provider_issuer?: string
  provider_authorization_endpoint?: string
  provider_token_endpoint?: string
  provider_upstream_oauth_scopes?: string
  provider_api_key_header?: string
  provider_workload_audience?: string
  provider_client_id?: string
  provider_allowed_token_hosts?: string
  provider_auth_scheme?: string
  provider_forward_caracal_identity?: string
  activate_policy?: string
  generate_profile?: string
  write_files?: string
  overwrite_files?: string
  profile_path?: string
  secret_file_path?: string
  credential_env?: string
}

interface ProfileTarget {
  path: string
  secretPath: string
  credentialEnv: string
}

interface SetupResult {
  zone: Zone | { id: string; name: string }
  zoneCreated: boolean
  application: Application
  applicationCreated: boolean
  clientSecret?: string
  resource: Resource
  resourceCreated: boolean
  resourceUpdated: boolean
  policy?: {
    id: string
    name: string
    version: PolicyVersion
    policy_set_id: string
    policy_set_version_id: string
  }
  profile?: {
    path: string
    secretPath: string
    credentialEnv: string
    gatewayUrl: string
    content: string
  }
  fileWrite?: {
    status: 'written' | 'failed' | 'skipped'
    profile_path?: string
    secret_file?: string
    overwrite?: boolean
    error?: string
  }
  requestPath?: string
}

export function firstSetupView(ctx: Ctx): View {
  return new FirstSetupWizardView(ctx)
}

type SetupStepKey =
  | 'zone'
  | 'application'
  | 'resource'
  | 'upstream'
  | 'provider'
  | 'provider_kind'
  | 'provider_issuer'
  | 'provider_token_endpoint'
  | 'provider_api_key_header'
  | 'provider_workload_audience'
  | 'scopes'
  | 'review'

interface SetupStep {
  key: SetupStepKey
  question: string
  explanation: string
  emptyLabel: string
  kind?: 'text' | 'bool'
  required?: boolean
  picker?: boolean
  options?: string[]
}

class FirstSetupWizardView implements View {
  readonly title = 'guided setup'
  readonly isTextEntry = true
  private readonly ctx: Ctx
  private step: SetupStepKey = 'zone'
  private values: SetupValues = {
    activate_policy: 'true',
    generate_profile: 'true',
    write_files: 'false',
    overwrite_files: 'false',
    profile_path: defaultRuntimeConfigPath(),
    provider_kind: 'oauth2',
    provider_forward_caracal_identity: 'false',
  }
  private selectedZone: Zone | undefined
  private selectedApplication: Application | undefined
  private selectedResource: Resource | undefined
  private selectedProvider: Provider | undefined
  private submitting = false

  constructor(ctx: Ctx) {
    this.ctx = ctx
  }

  async init(app: App): Promise<void> {
    if (!this.ctx.zoneId) return
    this.selectedZone = await this.ctx.client.zones.get(this.ctx.zoneId)
    this.values.selected_zone_id = this.selectedZone.id
    app.invalidate()
  }

  hints(): string[] {
    if (this.submitting) return []
    if (this.step === 'review') return ['enter:create', 'left:back', 'A:advanced', '?:info', 'esc:cancel']
    const step = this.currentStep()
    const hints = ['enter:next', 'left:back', 'A:advanced', '?:info', 'esc:cancel']
    if (step.kind === 'bool') hints.unshift('space:toggle')
    else if (step.options) hints.unshift('→:option')
    else hints.unshift('type:answer')
    if (step.options) hints.push('→:option')
    else if (step.picker) hints.push('→:select')
    return hints
  }

  render(ctx: ViewContext): string[] {
    this.normalizeStep()
    if (this.step === 'review') return this.renderReview(ctx)
    const step = this.currentStep()
    const steps = this.steps()
    const lines: string[] = [
      '',
      ' ' + ui.title(`Step ${steps.indexOf(this.step) + 1} of ${steps.length}: ${step.question}`),
      ' ' + ui.muted(step.explanation),
      '',
      ` ${ui.muted('Answer')} ${this.renderInput(step)}`,
    ]
    if (step.required) lines.push(' ' + ui.muted('Required for first success.'))
    if (step.options) lines.push(' ' + ui.muted('Press right arrow to cycle options.'))
    else if (step.picker) lines.push(' ' + ui.muted('Press right arrow to choose an existing item, or type a name to create one.'))
    if (this.submitting) lines.push('', ' ' + ui.muted('creating setup...'))
    return lines.map((line) => truncate(line, ctx.size.cols))
  }

  async onKey(key: Key, ctx: ViewContext): Promise<void> {
    if (this.submitting) return
    this.normalizeStep()
    if (key === 'esc') {
      ctx.app.pop()
      return
    }
    if (key === 'A') {
      this.openAdvanced(ctx.app)
      return
    }
    if (key === '?') {
      this.openStepInfo(ctx.app)
      return
    }
    if (key === 'left' || key === 'up') {
      this.previousStep()
      return
    }
    if (this.step === 'review') {
      if (key === 'enter') await this.create(ctx.app)
      return
    }
    const step = this.currentStep()
    if (key === 'right' && step.options) {
      this.cycleOption(step)
      return
    }
    if (key === 'right' && step.picker) {
      await this.openPicker(ctx.app)
      return
    }
    if (key === 'space' && step.kind === 'bool') {
      const valueKey = stepValueKey(step.key)
      if (valueKey) this.values[valueKey] = this.values[valueKey] === 'true' ? 'false' : 'true'
      return
    }
    if (key === 'enter' || key === 'tab' || key === 'down') {
      this.nextStep(ctx.app)
      return
    }
    if (step.kind === 'bool' || step.options) return
    if (key === 'backspace') {
      const valueKey = stepValueKey(step.key)
      this.setTextValue(step.key, ((valueKey ? this.values[valueKey] : '') ?? '').slice(0, -1))
      return
    }
    const text = textInput(key)
    if (text !== undefined) this.appendText(step.key, text)
  }

  private currentStep(): SetupStep {
    const steps: Record<SetupStepKey, SetupStep> = {
      zone: {
        key: 'zone',
        question: 'Choose or create a zone',
        explanation: 'A zone groups the apps, resources, and policies for one workload or team.',
        emptyLabel: 'zone name',
        required: true,
        picker: true,
      },
      application: {
        key: 'application',
        question: 'Create or select an agent app',
        explanation: 'The agent app is the workload identity that will ask for access to the resource.',
        emptyLabel: 'agent app name',
        required: true,
        picker: this.hasExistingZone(),
      },
      resource: {
        key: 'resource',
        question: 'Create or select a resource',
        explanation: 'A resource is the protected API, OAuth audience, gRPC service, MCP server, or SDK capability this agent app will call.',
        emptyLabel: 'resource name',
        required: true,
        picker: this.hasExistingZone(),
      },
      upstream: {
        key: 'upstream',
        question: 'Enter external upstream URL',
        explanation: 'Most first setups protect an external API, gRPC service, MCP server, or SDK endpoint through Gateway. Leave blank only for a direct Caracal resource.',
        emptyLabel: 'https://api.example.com',
      },
      provider: {
        key: 'provider',
        question: 'Choose or create a credential provider',
        explanation: 'A provider supplies upstream OAuth/OIDC, API-key, or workload identity context for this Gateway-routed resource. Leave blank only when the upstream needs no provider credentials.',
        emptyLabel: 'provider name',
        picker: this.hasExistingZone(),
      },
      provider_kind: {
        key: 'provider_kind',
        question: 'Choose provider type',
        explanation: 'Provider type controls the credential fields needed below.',
        emptyLabel: 'oauth2',
        required: true,
        options: [...PROVIDER_KINDS],
      },
      provider_issuer: {
        key: 'provider_issuer',
        question: 'Enter provider issuer',
        explanation: 'Issuer identifies the OIDC or workload identity trust authority.',
        emptyLabel: 'https://issuer.example.com',
        required: true,
      },
      provider_token_endpoint: {
        key: 'provider_token_endpoint',
        question: 'Enter provider token endpoint',
        explanation: 'Gateway uses this HTTPS endpoint to exchange or refresh upstream provider tokens.',
        emptyLabel: 'https://issuer.example.com/oauth/token',
        required: true,
      },
      provider_api_key_header: {
        key: 'provider_api_key_header',
        question: 'Enter API key header',
        explanation: 'This is the HTTP header where the upstream service expects its API key.',
        emptyLabel: 'X-API-Key',
        required: true,
      },
      provider_workload_audience: {
        key: 'provider_workload_audience',
        question: 'Enter workload audience',
        explanation: 'Audience is the exact value the workload identity provider expects for exchanged tokens.',
        emptyLabel: 'api://payments',
        required: true,
      },
      scopes: {
        key: 'scopes',
        question: 'Enter Caracal scopes',
        explanation: 'A Caracal scope is the permission your policy evaluates for this resource. Keep upstream OAuth scopes in the provider config.',
        emptyLabel: 'Caracal scopes',
        required: true,
      },
      review: {
        key: 'review',
        question: 'Review and create',
        explanation: 'Check the setup plan, then create the missing objects and first access policy.',
        emptyLabel: '',
      },
    }
    return steps[this.step]
  }

  private steps(): SetupStepKey[] {
    const steps: SetupStepKey[] = []
    if (!this.selectedZone) steps.push('zone')
    steps.push('application', 'resource')
    if (!this.selectedResource) steps.push('upstream')
    if (this.needsProviderStep()) {
      steps.push('provider')
      if (this.needsProviderCreateSteps()) {
        steps.push('provider_kind')
        const kind = providerKind(this.values.provider_kind)
        if (kind === 'oidc' || kind === 'workload') steps.push('provider_issuer')
        if (kind === 'oauth2' || kind === 'oidc' || kind === 'workload') steps.push('provider_token_endpoint')
        if (kind === 'apikey') steps.push('provider_api_key_header')
        if (kind === 'workload') steps.push('provider_workload_audience')
      }
    }
    if (this.needsScopesStep()) steps.push('scopes')
    steps.push('review')
    return steps
  }

  private normalizeStep(): void {
    const steps = this.steps()
    if (!steps.includes(this.step)) this.step = steps[0] ?? 'review'
  }

  private needsScopesStep(): boolean {
    return !this.selectedResource || splitList(this.values.resource_scopes).length === 0
  }

  private needsProviderStep(): boolean {
    return !this.selectedResource && Boolean(trimmed(this.values.upstream_url))
  }

  private needsProviderCreateSteps(): boolean {
    return this.needsProviderStep() && !this.selectedProvider && Boolean(trimmed(this.values.provider_name))
  }

  private renderInput(step: SetupStep): string {
    const key = stepValueKey(step.key)
    if (step.kind === 'bool') return ui.input((key && this.values[key] === 'true') ? '[ yes ]' : '[ no ]')
    const value = this.displayValue(step.key)
    return ui.input(`[ ${sanitizeAnsi(value || `<${step.emptyLabel}>`)} ]`)
  }

  private displayValue(step: SetupStepKey): string {
    if (step === 'zone' && this.selectedZone && !this.values.zone_name) return `${zoneLabel(this.selectedZone)} (selected)`
    if (step === 'application' && this.selectedApplication && !this.values.agent_app_name) return `${this.selectedApplication.name} (selected)`
    if (step === 'resource' && this.selectedResource && !this.values.resource_name) return `${resourceLabel(this.selectedResource)} (selected)`
    if (step === 'provider' && this.selectedProvider && !this.values.provider_name) return `${providerLabel(this.selectedProvider)} (selected)`
    if (step === 'provider_kind') return providerKind(this.values.provider_kind)
    if (step === 'resource' && this.values.resource_name && !this.selectedResource) {
      return this.values.resource_name
    }
    const key = stepValueKey(step)
    return key ? this.values[key] ?? '' : ''
  }

  private renderReview(ctx: ViewContext): string[] {
    const resourceName = this.selectedResource ? resourceLabel(this.selectedResource) : requiredText(this.values.resource_name, 'resource is required')
    const resourceIdentifier = this.selectedResource?.identifier ?? resourceIdentifierFor(this.values)
    const lines: string[] = [
      '',
      ' ' + ui.title('Review and create'),
      ' ' + ui.muted('Console will create only what is missing and keep internal IDs resolved in the background.'),
      '',
      ` ${ui.muted('Zone')} ${this.selectedZone ? `${zoneLabel(this.selectedZone)} (selected)` : `${this.values.zone_name} (create)`}`,
      ` ${ui.muted('Agent app')} ${this.selectedApplication ? `${this.selectedApplication.name} (selected)` : `${this.values.agent_app_name} (create)`}`,
      ` ${ui.muted('Resource')} ${resourceName}${this.selectedResource ? ' (selected)' : ' (create)'}`,
      ` ${ui.muted('Resource identifier')} ${resourceIdentifier}`,
      ` ${ui.muted('Credential provider')} ${this.providerReviewLabel()}`,
      ` ${ui.muted('Caracal scopes')} ${splitList(this.values.resource_scopes).join(', ') || '<required>'}`,
      ` ${ui.muted('Access policy')} ${bool(this.values.activate_policy) ? 'create and activate real Rego allow-list' : 'skip'}`,
      ` ${ui.muted('Gateway')} ${trimmed(this.values.upstream_url) ? `${this.values.upstream_url}${normalizeRequestPath(this.values.request_path) ?? ''}` : 'skip for now'}`,
      ` ${ui.muted('Runtime profile')} ${boolDefault(this.values.generate_profile, true) ? boolDefault(this.values.write_files, false) ? 'write profile and secret files' : 'show commands only' : 'skip'}`,
      '',
      ' ' + ui.key('enter') + ui.muted(':create  ') + ui.key('A') + ui.muted(':advanced  ') + ui.key('left') + ui.muted(':back'),
    ]
    if (this.submitting) lines.push(' ' + ui.muted('creating setup...'))
    return lines.map((line) => truncate(line, ctx.size.cols))
  }

  private nextStep(app: App): void {
    const message = this.validateStep()
    if (message) {
      app.setStatus(message, 'error')
      return
    }
    const steps = this.steps()
    const index = steps.indexOf(this.step)
    this.step = steps[Math.min(index + 1, steps.length - 1)] ?? 'review'
  }

  private previousStep(): void {
    const steps = this.steps()
    const index = steps.indexOf(this.step)
    this.step = steps[Math.max(0, index - 1)] ?? 'review'
  }

  private cycleOption(step: SetupStep): void {
    if (!step.options || step.options.length === 0) return
    const key = stepValueKey(step.key)
    if (!key) return
    const current = this.values[key] || step.options[0]!
    const index = step.options.indexOf(current)
    this.setTextValue(step.key, step.options[(index + 1) % step.options.length]!)
  }

  private validateStep(): string | undefined {
    if (this.step === 'zone' && !this.selectedZone && !trimmed(this.values.zone_name)) return 'zone is required'
    if (this.step === 'application' && !this.selectedApplication && !trimmed(this.values.agent_app_name)) return 'agent app is required'
    if (this.step === 'resource' && !this.selectedResource && !trimmed(this.values.resource_name)) return 'resource is required'
    if (this.step === 'provider_kind' && !PROVIDER_KINDS.includes(providerKind(this.values.provider_kind))) return 'provider type is required'
    if (this.step === 'provider_issuer' && !trimmed(this.values.provider_issuer)) return 'provider issuer is required'
    if (this.step === 'provider_token_endpoint' && !trimmed(this.values.provider_token_endpoint)) return 'provider token endpoint is required'
    if (this.step === 'provider_api_key_header' && !trimmed(this.values.provider_api_key_header)) return 'API key header is required'
    if (this.step === 'provider_workload_audience' && !trimmed(this.values.provider_workload_audience)) return 'workload audience is required'
    if (this.step === 'scopes' && splitList(this.values.resource_scopes).length === 0) return 'at least one Caracal scope is required'
    return undefined
  }

  private async openPicker(app: App): Promise<void> {
    if (this.step === 'zone') {
      app.push(new EntityPickerView<Zone>({
        title: 'choose zone',
        load: () => this.ctx.client.zones.list(),
        value: (row) => row.id,
        label: zoneLabel,
        description: (row) => row.slug,
        onPick: async (id) => {
          this.selectedZone = await this.ctx.client.zones.get(id)
          this.values.selected_zone_id = id
          this.values.zone_name = ''
          this.clearZoneDependents()
        },
      }))
      return
    }
    const zoneId = this.selectedZone?.id
    if (!zoneId) {
      app.setStatus('select an existing zone before picking existing apps or resources', 'error')
      return
    }
    if (this.step === 'application') {
      app.push(new EntityPickerView<Application>({
        title: 'choose agent app',
        load: () => this.ctx.client.applications.list(zoneId),
        value: (row) => row.id,
        label: (row) => row.name,
        description: (row) => row.credential_type,
        onPick: async (id) => {
          this.selectedApplication = await this.ctx.client.applications.get(zoneId, id)
          this.values.selected_agent_app_id = id
          this.values.agent_app_name = ''
          this.values.existing_app_client_secret = ''
        },
      }))
      return
    }
    if (this.step === 'resource') {
      app.push(new EntityPickerView<Resource>({
        title: 'choose resource',
        load: async () => userResources(await this.ctx.client.resources.list(zoneId)),
        value: (row) => row.id,
        label: resourceLabel,
        description: (row) => [row.identifier, (row.scopes ?? []).join(',')].filter(Boolean).join('  '),
        onPick: async (id) => {
          this.selectedResource = await this.ctx.client.resources.get(zoneId, id)
          this.values.selected_resource_id = id
          this.values.resource_name = ''
          this.values.resource_scopes = (this.selectedResource.scopes ?? []).join(',')
          this.values.upstream_url = this.selectedResource.upstream_url ?? ''
          this.values.selected_provider_id = this.selectedResource.credential_provider_id ?? ''
        },
      }))
      return
    }
    if (this.step === 'provider') {
      app.push(new EntityPickerView<Provider>({
        title: 'choose provider',
        load: () => this.ctx.client.providers.list(zoneId),
        value: (row) => row.id,
        label: providerLabel,
        description: (row) => [row.identifier, row.kind ?? undefined].filter(Boolean).join('  '),
        onPick: async (id) => {
          this.selectedProvider = await this.ctx.client.providers.get(zoneId, id)
          this.values.selected_provider_id = id
          this.values.provider_name = ''
          this.clearProviderCreateValues()
        },
      }))
    }
  }

  private appendText(step: SetupStepKey, text: string): void {
    if (step === 'zone' && this.selectedZone) this.clearZoneSelection()
    if (step === 'application' && this.selectedApplication) this.clearApplicationSelection()
    if (step === 'resource' && this.selectedResource) this.clearResourceSelection()
    if (step === 'provider' && this.selectedProvider) this.clearProviderSelection()
    if (step === 'provider_kind') this.clearProviderTypeValues()
    const key = stepValueKey(step)
    if (key) this.values[key] = (this.values[key] ?? '') + text
  }

  private setTextValue(step: SetupStepKey, value: string): void {
    if (step === 'zone' && this.selectedZone) this.clearZoneSelection()
    if (step === 'application' && this.selectedApplication) this.clearApplicationSelection()
    if (step === 'resource' && this.selectedResource) this.clearResourceSelection()
    if (step === 'provider' && this.selectedProvider) this.clearProviderSelection()
    if (step === 'provider_kind') this.clearProviderTypeValues()
    const key = stepValueKey(step)
    if (key) this.values[key] = value
  }

  private clearZoneSelection(): void {
    this.selectedZone = undefined
    this.values.selected_zone_id = ''
    this.clearZoneDependents()
  }

  private clearZoneDependents(): void {
    this.clearApplicationSelection()
    this.clearResourceSelection()
    this.clearProviderSelection()
  }

  private clearApplicationSelection(): void {
    this.selectedApplication = undefined
    this.values.selected_agent_app_id = ''
    this.values.existing_app_client_secret = ''
  }

  private clearResourceSelection(): void {
    this.selectedResource = undefined
    this.values.selected_resource_id = ''
    this.values.resource_scopes = ''
    this.values.upstream_url = ''
    this.clearProviderSelection()
  }

  private clearProviderSelection(): void {
    this.selectedProvider = undefined
    this.values.selected_provider_id = ''
    this.values.provider_name = ''
    this.clearProviderCreateValues()
  }

  private clearProviderCreateValues(): void {
    this.values.provider_identifier = ''
    this.values.provider_kind = 'oauth2'
    this.clearProviderTypeValues()
  }

  private clearProviderTypeValues(): void {
    this.values.provider_issuer = ''
    this.values.provider_token_endpoint = ''
    this.values.provider_api_key_header = ''
    this.values.provider_workload_audience = ''
    this.values.provider_client_id = ''
    this.values.provider_authorization_endpoint = ''
    this.values.provider_upstream_oauth_scopes = ''
    this.values.provider_allowed_token_hosts = ''
    this.values.provider_auth_scheme = ''
    this.values.provider_forward_caracal_identity = 'false'
  }

  private hasExistingZone(): boolean {
    return Boolean(this.selectedZone?.id)
  }

  private openAdvanced(app: App): void {
    const values = this.values
    app.push(new FormView({
      title: 'guided setup advanced',
      submitLabel: 'save',
      initialValues: { upstream_url: values.upstream_url ?? '' },
      fields: [
        { key: 'resource_identifier', label: 'resource identifier', kind: 'text', default: values.resource_identifier ?? '', visible: () => !this.selectedResource, hint: 'optional; generated from the resource name when blank' },
        { key: 'request_path', label: 'first request path', kind: 'text', default: values.request_path ?? '', dependsOn: 'upstream_url', hint: 'optional; used only to show an exact first Gateway curl example' },
        { key: 'provider_identifier', label: 'provider identifier', kind: 'text', default: values.provider_identifier ?? '', visible: () => this.needsProviderCreateSteps(), hint: 'optional; generated from provider name when blank' },
        { key: 'provider_client_id', label: 'provider client ID', kind: 'text', default: values.provider_client_id ?? '', visible: () => this.needsProviderCreateSteps() && ['oauth2', 'oidc'].includes(providerKind(this.values.provider_kind)), hint: 'optional OAuth client identifier when the upstream provider requires one' },
        { key: 'provider_authorization_endpoint', label: 'authorization endpoint', kind: 'text', default: values.provider_authorization_endpoint ?? '', visible: () => this.needsProviderCreateSteps() && ['oauth2', 'oidc'].includes(providerKind(this.values.provider_kind)), hint: 'optional OAuth browser authorization endpoint' },
        { key: 'provider_upstream_oauth_scopes', label: 'upstream OAuth scopes', kind: 'list', default: values.provider_upstream_oauth_scopes ?? '', visible: () => this.needsProviderCreateSteps() && ['oauth2', 'oidc'].includes(providerKind(this.values.provider_kind)), hint: 'provider-side scopes; Caracal scopes stay in the main setup step' },
        { key: 'provider_allowed_token_hosts', label: 'allowed token hosts', kind: 'list', default: values.provider_allowed_token_hosts ?? '', visible: () => this.needsProviderCreateSteps() && ['oauth2', 'oidc', 'workload'].includes(providerKind(this.values.provider_kind)), hint: 'optional; inferred from token endpoint when blank' },
        { key: 'provider_auth_scheme', label: 'auth scheme', kind: 'text', default: values.provider_auth_scheme ?? '', visible: () => this.needsProviderCreateSteps() && providerKind(this.values.provider_kind) === 'apikey', hint: 'optional; leave blank when the upstream expects the raw API key' },
        { key: 'provider_forward_caracal_identity', label: 'forward Caracal identity', kind: 'bool', default: values.provider_forward_caracal_identity ?? 'false', visible: () => this.needsProviderCreateSteps() },
        { key: 'activate_policy', label: 'activate policy', kind: 'bool', default: values.activate_policy ?? 'true' },
        { key: 'generate_profile', label: 'runtime profile', kind: 'bool', default: values.generate_profile ?? 'true' },
        { key: 'write_files', label: 'write profile files', kind: 'bool', default: values.write_files ?? 'false', dependsOn: { generate_profile: 'true' } },
        { key: 'existing_app_client_secret', label: 'existing app secret', kind: 'text', default: values.existing_app_client_secret ?? '', visible: () => Boolean(this.selectedApplication), required: (current) => current.write_files === 'true', dependsOn: { generate_profile: 'true', write_files: 'true' }, hint: 'required only when writing files for a selected existing app because secrets cannot be retrieved' },
        { key: 'overwrite_files', label: 'overwrite files', kind: 'bool', default: values.overwrite_files ?? 'false', dependsOn: { generate_profile: 'true', write_files: 'true' }, hint: 'kept off unless replacing existing generated setup files is intended' },
        { key: 'profile_path', label: 'profile path', kind: 'text', default: values.profile_path ?? defaultRuntimeConfigPath(), dependsOn: { generate_profile: 'true' } },
        { key: 'secret_file_path', label: 'secret file', kind: 'text', default: values.secret_file_path ?? '', dependsOn: { generate_profile: 'true' }, hint: 'optional; derived from profile path when blank' },
        { key: 'credential_env', label: 'token env', kind: 'text', default: values.credential_env ?? '', dependsOn: { generate_profile: 'true' }, hint: 'optional; derived from the resource identifier when blank' },
      ],
      onSubmit: async (raw, advancedApp) => {
        Object.assign(this.values, raw)
        advancedApp.pop()
      },
    }))
  }

  private openStepInfo(app: App): void {
    const step = this.currentStep()
    openInfo(app, infoPage({
      title: step.question,
      meaning: step.explanation,
      when: step.key === 'review' ? 'Use this after checking the plan and advanced settings.' : 'Use this step to give Console the smallest value needed for the first working setup.',
      valid: step.kind === 'bool' ? 'Toggle yes or no.' : step.options ? `Choose one of: ${step.options.join(', ')}.` : step.picker ? 'Select an existing object or type a name to create one.' : 'Plain text; comma-separated where the prompt asks for scopes.',
      after: step.key === 'review' ? 'Console creates only missing objects, activates the selected policy path, and shows setup output.' : 'Console carries this value forward and resolves internal IDs in the background.',
    }))
  }

  private async create(app: App): Promise<void> {
    const message = this.validateAll()
    if (message) {
      app.setStatus(message, 'error')
      return
    }
    this.submitting = true
    app.invalidate()
    try {
      const result = await runFirstSetup(this.ctx, this.buildValues(), app)
      app.pop()
      app.push(new DetailView({
        title: 'first setup result',
        load: async () => setupSummary(result),
        mask: maskSecretField,
      }))
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      app.setStatus(scrubTokens(msg), 'error')
      this.submitting = false
      app.invalidate()
    }
  }

  private validateAll(): string | undefined {
    for (const step of this.steps()) {
      if (step === 'review') continue
      this.step = step
      const message = this.validateStep()
      if (message) return message
    }
    this.step = 'review'
    return undefined
  }

  private buildValues(): SetupValues {
    return {
      ...this.values,
      selected_zone_id: this.selectedZone?.id,
      zone_name: this.selectedZone ? '' : this.values.zone_name,
      selected_agent_app_id: this.selectedApplication?.id,
      agent_app_name: this.selectedApplication ? '' : this.values.agent_app_name,
      selected_resource_id: this.selectedResource?.id,
      resource_name: this.selectedResource ? '' : this.values.resource_name,
      selected_provider_id: this.selectedProvider?.id ?? this.values.selected_provider_id,
      provider_name: this.selectedProvider ? '' : this.values.provider_name,
    }
  }

  private providerReviewLabel(): string {
    if (this.selectedResource?.credential_provider_id) return this.selectedResource.credential_provider_id
    if (this.selectedProvider) return `${providerLabel(this.selectedProvider)} (selected)`
    if (trimmed(this.values.provider_name)) return `${this.values.provider_name} (${providerKind(this.values.provider_kind)} create)`
    const selectedProviderId = trimmed(this.values.selected_provider_id)
    if (selectedProviderId) return selectedProviderId
    return trimmed(this.values.upstream_url) ? 'none selected' : 'not needed'
  }
}

async function runFirstSetup(ctx: Ctx, values: SetupValues, app: App): Promise<SetupResult> {
  const scopes = splitList(values.resource_scopes)
  if (scopes.length === 0) throw new Error('at least one Caracal scope is required')
  const shouldGenerateProfile = boolDefault(values.generate_profile, true)
  const writeFiles = shouldGenerateProfile && boolDefault(values.write_files, false)
  const overwriteFiles = boolDefault(values.overwrite_files, false)
  if (writeFiles && values.selected_agent_app_id && !trimmed(values.existing_app_client_secret)) {
    throw new Error('client secret is required to write files for an existing agent app')
  }

  const existingZoneId = trimmed(values.selected_zone_id) ?? (!trimmed(values.zone_name) ? ctx.zoneId : undefined)
  const applicationName = await setupApplicationName(ctx, existingZoneId, values)
  const targetResourceIdentifier = await setupResourceIdentifier(ctx, existingZoneId, values)
  const target = shouldGenerateProfile
    ? profileTarget(values, applicationName, targetResourceIdentifier)
    : undefined
  if (writeFiles && target) await assertWritableTarget(target, overwriteFiles)

  const zoneResult = await ensureZone(ctx, values, app)
  const applicationResult = await ensureApplication(ctx, zoneResult.zone.id, values)
  const upstreamUrl = trimmed(values.upstream_url)
  const providerId = await ensureProvider(ctx, zoneResult.zone.id, values, upstreamUrl)
  const resourceResult = await ensureResource(ctx, zoneResult.zone.id, applicationResult.application.id, values, scopes, upstreamUrl, providerId)

  const policy = bool(values.activate_policy)
    ? await createFirstPolicy(ctx, zoneResult.zone.id, applicationResult.application.id, resourceResult.resource.identifier, scopes)
    : undefined
  const profile = target
    ? buildProfile(target, zoneResult.zone.id, applicationResult.application.id, resourceResult.resource.identifier, upstreamUrl)
    : undefined
  const requestPath = normalizeRequestPath(values.request_path)
  const fileWrite = profile
    ? await setupFileWrite(profile, applicationResult.clientSecret, writeFiles, overwriteFiles)
    : undefined

  return {
    zone: zoneResult.zone,
    zoneCreated: zoneResult.created,
    application: applicationResult.application,
    applicationCreated: applicationResult.created,
    clientSecret: applicationResult.created ? applicationResult.clientSecret : undefined,
    resource: resourceResult.resource,
    resourceCreated: resourceResult.created,
    resourceUpdated: resourceResult.updated,
    policy,
    profile,
    fileWrite,
    requestPath,
  }
}

async function ensureZone(
  ctx: Ctx,
  values: SetupValues,
  app: App,
): Promise<{ zone: Zone | { id: string; name: string }; created: boolean }> {
  const selectedZoneId = trimmed(values.selected_zone_id)
  if (selectedZoneId) return { zone: await ctx.client.zones.get(selectedZoneId), created: false }
  const zoneName = trimmed(values.zone_name)
  if (!zoneName && ctx.zoneId) {
    return { zone: await ctx.client.zones.get(ctx.zoneId), created: false }
  }
  if (!zoneName) throw new Error('zone name is required when no zone is selected')
  const zone = await ctx.client.zones.create({ name: zoneName })
  ctx.onZoneSelect?.(zone.id, zone.slug)
  app.setStatus(`zone set to ${zone.slug}`)
  return { zone, created: true }
}

async function ensureApplication(
  ctx: Ctx,
  zoneId: string,
  values: SetupValues,
): Promise<{ application: Application; created: boolean; clientSecret?: string }> {
  const selectedApplicationId = trimmed(values.selected_agent_app_id)
  if (selectedApplicationId) {
    return {
      application: await ctx.client.applications.get(zoneId, selectedApplicationId),
      created: false,
      clientSecret: trimmed(values.existing_app_client_secret),
    }
  }
  const clientSecret = generateClientSecret()
  const application = await ctx.client.applications.create(zoneId, {
    name: requiredText(values.agent_app_name, 'agent app is required'),
    registration_method: 'managed',
    credential_type: 'token',
    client_secret: clientSecret,
    consent: false,
  })
  return { application, created: true, clientSecret }
}

async function setupApplicationName(ctx: Ctx, zoneId: string | undefined, values: SetupValues): Promise<string> {
  const selectedApplicationId = trimmed(values.selected_agent_app_id)
  if (selectedApplicationId) {
    if (!zoneId) throw new Error('zone is required before selecting an existing agent app')
    return (await ctx.client.applications.get(zoneId, selectedApplicationId)).name
  }
  return requiredText(values.agent_app_name, 'agent app is required')
}

async function setupResourceIdentifier(ctx: Ctx, zoneId: string | undefined, values: SetupValues): Promise<string> {
  const selectedResourceId = trimmed(values.selected_resource_id)
  if (selectedResourceId) {
    if (!zoneId) throw new Error('zone is required before selecting an existing resource')
    return (await ctx.client.resources.get(zoneId, selectedResourceId)).identifier
  }
  return resourceIdentifierFor(values)
}

async function ensureProvider(
  ctx: Ctx,
  zoneId: string,
  values: SetupValues,
  upstreamUrl: string | undefined,
): Promise<string | undefined> {
  if (!upstreamUrl) return undefined
  const selectedProviderId = trimmed(values.selected_provider_id)
  if (selectedProviderId) return selectedProviderId
  if (!trimmed(values.provider_name)) return undefined
  const provider = await ctx.client.providers.create(zoneId, {
    identifier: providerIdentifierFor(values),
    name: trimmed(values.provider_name),
    kind: providerKind(values.provider_kind),
    client_id: trimmed(values.provider_client_id),
    config_json: providerConfigFromValues(values),
  })
  return provider.id
}

async function ensureResource(
  ctx: Ctx,
  zoneId: string,
  applicationId: string,
  values: SetupValues,
  scopes: string[],
  upstreamUrl: string | undefined,
  providerId: string | undefined,
): Promise<{ resource: Resource; created: boolean; updated: boolean }> {
  const selectedResourceId = trimmed(values.selected_resource_id)
  if (!selectedResourceId) {
    return {
      resource: await ctx.client.resources.create(zoneId, {
        identifier: resourceIdentifierFor(values),
        name: trimmed(values.resource_name),
        scopes,
        upstream_url: upstreamUrl,
        gateway_application_id: upstreamUrl ? applicationId : undefined,
        credential_provider_id: providerId,
        prefix: upstreamUrl ? true : undefined,
      }),
      created: true,
      updated: false,
    }
  }

  const current = await ctx.client.resources.get(zoneId, selectedResourceId)
  const patch: Partial<ResourceInput> = {}
  if (!sameList(current.scopes ?? [], scopes)) patch.scopes = scopes
  if (upstreamUrl && current.upstream_url !== upstreamUrl) patch.upstream_url = upstreamUrl
  if (upstreamUrl && current.gateway_application_id !== applicationId) patch.gateway_application_id = applicationId
  if (upstreamUrl && current.prefix !== true) patch.prefix = true
  if (providerId && current.credential_provider_id !== providerId) patch.credential_provider_id = providerId
  const updated = Object.keys(patch).length > 0
  return {
    resource: updated
      ? await ctx.client.resources.patch(zoneId, selectedResourceId, patch)
      : current,
    created: false,
    updated,
  }
}

function stepValueKey(step: SetupStepKey): keyof SetupValues | undefined {
  switch (step) {
    case 'zone': return 'zone_name'
    case 'application': return 'agent_app_name'
    case 'resource': return 'resource_name'
    case 'upstream': return 'upstream_url'
    case 'provider': return 'provider_name'
    case 'provider_kind': return 'provider_kind'
    case 'provider_issuer': return 'provider_issuer'
    case 'provider_token_endpoint': return 'provider_token_endpoint'
    case 'provider_api_key_header': return 'provider_api_key_header'
    case 'provider_workload_audience': return 'provider_workload_audience'
    case 'scopes': return 'resource_scopes'
    case 'review': return undefined
  }
}

function resourceIdentifierFor(values: SetupValues): string {
  return trimmed(values.resource_identifier) ?? `resource://${safeName(requiredText(values.resource_name, 'resource is required'))}`
}

function providerIdentifierFor(values: SetupValues): string {
  return trimmed(values.provider_identifier) ?? `provider://${safeName(requiredText(values.provider_name, 'provider is required'))}`
}

function providerKind(value: string | undefined): ProviderKind {
  return PROVIDER_KINDS.includes(value as ProviderKind) ? value as ProviderKind : 'oauth2'
}

function providerConfigFromValues(values: SetupValues): JsonObject {
  const kind = providerKind(values.provider_kind)
  const config: JsonObject = {}
  mergeConfigText(config, 'issuer', values.provider_issuer)
  mergeConfigText(config, 'authorization_endpoint', values.provider_authorization_endpoint)
  mergeConfigText(config, 'token_endpoint', values.provider_token_endpoint)
  mergeConfigList(config, 'allowed_token_hosts', values.provider_allowed_token_hosts || inferredTokenHosts(values.provider_token_endpoint))
  mergeConfigList(config, 'upstream_oauth_scopes', values.provider_upstream_oauth_scopes)
  mergeConfigText(config, 'header_name', values.provider_api_key_header)
  mergeConfigText(config, 'auth_scheme', values.provider_auth_scheme)
  mergeConfigText(config, 'audience', values.provider_workload_audience)
  if (values.provider_forward_caracal_identity === 'true') config.forward_caracal_identity = true
  validateProviderConfig(kind, config)
  return config
}

function mergeConfigText(config: JsonObject, key: string, value: string | undefined): void {
  const text = value?.trim()
  if (text) config[key] = text
}

function mergeConfigList(config: JsonObject, key: string, value: string | undefined): void {
  const items = splitList(value)
  if (items.length > 0) config[key] = items
}

function inferredTokenHosts(endpoint: string | undefined): string {
  const value = trimmed(endpoint)
  if (!value) return ''
  try {
    return new URL(value).host
  } catch {
    return ''
  }
}

function validateProviderConfig(kind: ProviderKind, config: JsonObject): void {
  if (kind === 'apikey') {
    requireString(config, 'header_name', 'apikey provider config requires header_name')
    return
  }
  if (kind === 'workload') {
    requireString(config, 'issuer', 'workload provider config requires issuer')
    requireString(config, 'audience', 'workload provider config requires audience')
  }
  if (kind === 'oidc') requireString(config, 'issuer', 'oidc provider config requires issuer')
  requireString(config, 'token_endpoint', `${kind} provider config requires token_endpoint`)
  requireStringList(config, 'allowed_token_hosts', `${kind} provider config requires allowed_token_hosts`)
}

function requireString(config: JsonObject, key: string, message: string): void {
  if (typeof config[key] !== 'string' || config[key].trim().length === 0) throw new Error(message)
}

function requireStringList(config: JsonObject, key: string, message: string): void {
  const value = config[key]
  if (!Array.isArray(value) || value.length === 0 || value.some((item) => typeof item !== 'string' || item.trim().length === 0)) {
    throw new Error(message)
  }
}

function userResources(resources: Resource[]): Resource[] {
  const audience = process.env.CONTROL_AUDIENCE ?? DEFAULT_CONTROL_AUDIENCE
  return resources.filter((resource) => resource.identifier !== audience)
}

function zoneLabel(zone: Zone | { name?: string; slug?: string; id: string }): string {
  return zone.name || zone.slug || zone.id
}

function resourceLabel(resource: Resource): string {
  return resource.name || resource.identifier || resource.id
}

function providerLabel(provider: Provider): string {
  return provider.name || provider.identifier || provider.id
}

function sameList(left: string[], right: string[]): boolean {
  if (left.length !== right.length) return false
  return left.every((value, index) => value === right[index])
}

async function createFirstPolicy(
  ctx: Ctx,
  zoneId: string,
  applicationId: string,
  resourceIdentifier: string,
  scopes: string[],
): Promise<SetupResult['policy']> {
  const policy = await ctx.client.policies.create(zoneId, {
    name: 'Guided setup access policy',
    description: 'Real Rego allow-list approved during guided setup. Allows only the configured agent app to request the configured protected resource with the configured Caracal scopes.',
    content: firstAccessPolicy(applicationId, resourceIdentifier, scopes),
  })
  const policySet = await ctx.client.policySets.create(zoneId, 'Guided setup access policy set', 'Active policy set approved during guided setup.')
  const version = await ctx.client.policySets.addVersion(zoneId, policySet.id, [{ policy_version_id: policy.version.id }])
  await ctx.client.policySets.activate(zoneId, policySet.id, version.id)
  return {
    id: policy.id,
    name: policy.name,
    version: policy.version,
    policy_set_id: policySet.id,
    policy_set_version_id: version.id,
  }
}

function firstAccessPolicy(applicationId: string, resourceIdentifier: string, scopes: string[]): string {
  const allowedScopes = scopes.map((scope) => quoteRego(scope)).join(', ')
  return `package caracal.authz

import rego.v1

default result := {"decision": "deny", "evaluation_status": "complete", "determining_policies": [], "diagnostics": []}

allowed_scopes := {${allowedScopes}}

result := {"decision": "allow", "evaluation_status": "complete", "determining_policies": [{"policy": "first-access"}], "diagnostics": []} if {
  input.principal.id == ${quoteRego(applicationId)}
  input.resource.identifier == ${quoteRego(resourceIdentifier)}
  every scope in input.context.requested_scopes {
    scope in allowed_scopes
  }
}
`
}

function buildProfile(
  target: ProfileTarget,
  zoneId: string,
  applicationId: string,
  resourceIdentifier: string,
  upstreamUrl: string | undefined,
): SetupResult['profile'] {
  const stsUrl = process.env.CARACAL_STS_URL ?? process.env.CARACAL_ZONE_URL ?? DEFAULT_ZONE_URL
  const coordinatorUrl = process.env.CARACAL_COORDINATOR_URL ?? DEFAULT_COORDINATOR_URL
  const gatewayUrl = process.env.CARACAL_GATEWAY_URL ?? DEFAULT_GATEWAY_URL
  const lines = [
    `zone_url = ${quoteToml(stsUrl)}`,
    `sts_url = ${quoteToml(stsUrl)}`,
    `coordinator_url = ${quoteToml(coordinatorUrl)}`,
    `gateway_url = ${quoteToml(gatewayUrl)}`,
    `zone_id = ${quoteToml(zoneId)}`,
    `application_id = ${quoteToml(applicationId)}`,
    `app_client_secret_file = ${quoteToml(target.secretPath)}`,
    'continue_on_failure = false',
    '',
    '[[credentials]]',
    `env = ${quoteToml(target.credentialEnv)}`,
    `resource = ${quoteToml(resourceIdentifier)}`,
  ]
  if (upstreamUrl) lines.push(`upstream_prefix = ${quoteToml(upstreamUrl)}`)
  return { ...target, gatewayUrl, content: lines.join('\n') + '\n' }
}

function setupSummary(result: SetupResult): Record<string, unknown> {
  const summary: Record<string, unknown> = {
    outcome: result.policy ? 'ready for first protected run' : 'objects created; activate a policy before requesting access',
    zone: {
      id: result.zone.id,
      name: result.zone.name,
      status: result.zoneCreated ? 'created' : 'selected',
    },
    agent_app: {
      id: result.application.id,
      name: result.application.name,
      status: result.applicationCreated ? 'created' : 'selected',
      ...(result.clientSecret
        ? {
            client_secret: result.clientSecret,
            note: 'Store client_secret now. It cannot be retrieved later.',
          }
        : {
            note: 'Existing app selected. Use its existing client secret in the generated secret file.',
          }),
    },
    protected_resource: {
      id: result.resource.id,
      identifier: result.resource.identifier,
      status: result.resourceCreated ? 'created' : result.resourceUpdated ? 'selected and updated' : 'selected',
      scopes: result.resource.scopes,
      gateway_route: result.resource.gateway_application_id ? 'enabled' : 'not configured',
    },
  }
  if (result.policy) {
    summary.access_policy = {
      status: 'created and activated',
      kind: 'real Rego allow-list policy',
      why_created: 'Guided setup creates this only when approved so the first protected call has an active authorization rule.',
      rules: [
        'deny by default',
        'allow only the selected agent app',
        'allow only the selected resource identifier',
        'allow only requested Caracal scopes that are in the configured scope list',
      ],
      policy_id: result.policy.id,
      policy_name: result.policy.name,
      policy_version_id: result.policy.version.id,
      policy_set_id: result.policy.policy_set_id,
      active_policy_set_version_id: result.policy.policy_set_version_id,
    }
  } else {
    summary.access_policy = {
      status: 'skipped',
      next_step: 'Create and activate a policy before requesting access.',
    }
  }
  if (result.profile) {
    const profile = result.profile
    const runtimeProfile: Record<string, unknown> = {
      path: profile.path,
      secret_file: profile.secretPath,
      token_env: profile.credentialEnv,
      content: profile.content,
      local_profile_setup: {
        posix: posixSetupCommands(profile),
        powershell: powershellSetupCommands(profile),
        secret_file_rule: result.fileWrite?.status === 'written'
          ? 'Console wrote the one-time client secret to secret_file.'
          : result.clientSecret
            ? 'Paste the revealed agent_app.client_secret as the only line in secret_file and keep the file owner-readable only.'
            : 'Paste the selected app client secret as the only line in secret_file and keep the file owner-readable only.',
      },
      first_success: {
        run_command_prefix: `CARACAL_CONFIG=${shellQuote(profile.path)} caracal run --`,
        workload_command: 'Append the real command that starts this workload.',
        sdk_process: `Set CARACAL_CONFIG=${profile.path} before calling Caracal.connect() from TypeScript, Python, or Go.`,
        gateway_request: result.resource.gateway_application_id
          ? gatewayRequest(result, profile)
          : 'Gateway routing was not configured because no upstream URL was provided.',
      },
      next_steps: [
        result.fileWrite?.status === 'written'
          ? 'Use the written runtime profile and secret file for local runs.'
          : 'Create the profile and secret files with the local_profile_setup commands.',
        'Run the real workload through caracal run with CARACAL_CONFIG set to the profile path.',
        'Use the injected token_env value on Gateway or SDK-managed requests for this resource.',
      ],
    }
    if (result.fileWrite) runtimeProfile.file_write = result.fileWrite
    summary.runtime_profile = runtimeProfile
  }
  summary.audit_explanation = {
    first_success: 'After the first protected call, open Audit, select the request, and use Explain to view the policy decision and Gateway result.',
    if_no_event: 'Re-check the active policy, resource identifier, Gateway route, and runtime profile before retrying.',
  }
  return summary
}

function posixSetupCommands(profile: NonNullable<SetupResult['profile']>): string[] {
  const dirs = Array.from(new Set([dirname(profile.path), dirname(profile.secretPath)]))
  return [
    `mkdir -p -- ${dirs.map(shellQuote).join(' ')}`,
    `umask 077; : > ${shellQuote(profile.secretPath)}`,
    `cat > ${shellQuote(profile.path)} <<'CARACAL_PROFILE'\n${profile.content}CARACAL_PROFILE`,
    `chmod 600 -- ${shellQuote(profile.path)} ${shellQuote(profile.secretPath)}`,
  ]
}

function profileTarget(values: SetupValues, agentAppName: string, resourceIdentifier: string): ProfileTarget {
  const path = trimmed(values.profile_path) ?? defaultRuntimeConfigPath()
  const secretPath = trimmed(values.secret_file_path) ?? join(dirname(path), `${safeName(agentAppName)}-client-secret`)
  if (path === secretPath) throw new Error('profile path and secret file must be different files')
  return {
    path,
    secretPath,
    credentialEnv: trimmed(values.credential_env) ?? credentialEnvName(resourceIdentifier),
  }
}

async function assertWritableTarget(target: ProfileTarget, overwrite: boolean): Promise<void> {
  if (overwrite) return
  const existing = await Promise.all([
    existingPath(target.path),
    existingPath(target.secretPath),
  ])
  const conflicts = existing.filter((path): path is string => Boolean(path))
  if (conflicts.length > 0) {
    throw new Error(`refusing to overwrite existing setup file: ${conflicts.join(', ')}`)
  }
}

async function existingPath(path: string): Promise<string | undefined> {
  try {
    await access(path)
    return path
  } catch (err) {
    if (isMissingPath(err)) return undefined
    throw err
  }
}

async function setupFileWrite(
  profile: NonNullable<SetupResult['profile']>,
  clientSecret: string | undefined,
  writeFiles: boolean,
  overwrite: boolean,
): Promise<SetupResult['fileWrite']> {
  if (!writeFiles) return { status: 'skipped' }
  if (!clientSecret) throw new Error('client secret is required to write setup files')
  try {
    await writeSetupFile(profile.path, profile.content, overwrite)
    await writeSetupFile(profile.secretPath, `${clientSecret}\n`, overwrite)
    return {
      status: 'written',
      profile_path: profile.path,
      secret_file: profile.secretPath,
      overwrite,
    }
  } catch (err) {
    return {
      status: 'failed',
      profile_path: profile.path,
      secret_file: profile.secretPath,
      overwrite,
      error: err instanceof Error ? err.message : String(err),
    }
  }
}

async function writeSetupFile(path: string, content: string, overwrite: boolean): Promise<void> {
  await mkdir(dirname(path), { recursive: true, mode: 0o700 })
  await writeFile(path, content, { mode: 0o600, flag: overwrite ? 'w' : 'wx' })
  await chmod(path, 0o600)
}

function isMissingPath(err: unknown): boolean {
  return typeof err === 'object' && err !== null && (err as { code?: unknown }).code === 'ENOENT'
}

function powershellSetupCommands(profile: NonNullable<SetupResult['profile']>): string[] {
  const dirs = Array.from(new Set([dirname(profile.path), dirname(profile.secretPath)]))
  return [
    `New-Item -ItemType Directory -Force -Path ${dirs.map(powershellQuote).join(', ')} | Out-Null`,
    `New-Item -ItemType File -Force -Path ${powershellQuote(profile.secretPath)} | Out-Null`,
    `Set-Content -NoNewline -Path ${powershellQuote(profile.path)} -Value @'\n${profile.content}'@`,
  ]
}

function gatewayRequest(result: SetupResult, profile: NonNullable<SetupResult['profile']>): string | Record<string, string> {
  if (!result.requestPath) {
    return {
      gateway_url: profile.gatewayUrl,
      resource_header: `X-Caracal-Resource: ${result.resource.identifier}`,
      authorization_header: `Authorization: Bearer $${profile.credentialEnv}`,
      request_path: 'Set first request path during guided setup to generate an exact curl command.',
    }
  }
  const url = `${profile.gatewayUrl.replace(/\/+$/, '')}${result.requestPath}`
  return `curl -fsS ${shellQuote(url)} -H "Authorization: Bearer \$${profile.credentialEnv}" -H ${shellQuote(`X-Caracal-Resource: ${result.resource.identifier}`)}`
}

function normalizeRequestPath(value: string | undefined): string | undefined {
  const path = trimmed(value)
  if (!path) return undefined
  return path.startsWith('/') ? path : `/${path}`
}

function splitList(value: string | undefined): string[] {
  return (value ?? '').split(',').map((item) => item.trim()).filter(Boolean)
}

function textInput(key: Key): string | undefined {
  if (key === 'space') return ' '
  if (typeof key !== 'string' || NAMED_KEYS.has(key)) return undefined
  const text = key
    .replace(BRACKETED_PASTE_PATTERN, '')
    .replace(ANSI_SEQUENCE_PATTERN, '')
    .replace(/[\u0000-\u001f\u007f-\u009f]/g, '')
  return text.length > 0 ? text : undefined
}

function bool(value: string | undefined): boolean {
  return value === undefined || value === '' || value === 'true'
}

function boolDefault(value: string | undefined, defaultValue: boolean): boolean {
  if (value === undefined || value === '') return defaultValue
  return value === 'true'
}

function trimmed(value: string | undefined): string | undefined {
  const text = value?.trim()
  return text ? text : undefined
}

function requiredText(value: string | undefined, message: string): string {
  const text = trimmed(value)
  if (!text) throw new Error(message)
  return text
}

function quoteRego(value: string): string {
  return JSON.stringify(value)
}

function quoteToml(value: string): string {
  return JSON.stringify(value)
}

function shellQuote(value: string): string {
  return `'${value.replace(/'/g, `'\\''`)}'`
}

function powershellQuote(value: string): string {
  return `'${value.replace(/'/g, `''`)}'`
}

function safeName(value: string): string {
  const normalized = value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
  return normalized || 'caracal-app'
}

function credentialEnvName(resourceIdentifier: string): string {
  const body = resourceIdentifier.toUpperCase().replace(/[^A-Z0-9]+/g, '_').replace(/^_+|_+$/g, '')
  const normalized = body.length > 0 ? body : 'RESOURCE'
  return `CARACAL_${normalized}_TOKEN`
}
