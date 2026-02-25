import type { CliCommand } from "@core/plugins/types";
import { promises as fs } from "fs";
import path from "path";

// ===== SERVER TEMPLATES =====

const getServerTemplate = (name: string, type: string, room?: string, hasClient = true) => {
  // Se room for especificado, precisa de constructor para definir this.room
  const needsConstructor = !!room;
  const constructorBlock = needsConstructor ? `
  constructor(initialState: Partial<typeof ${name}.defaultState> = {}, ws: FluxStackWebSocket, options?: { room?: string; userId?: string }) {
    super(initialState, ws, options)
    this.room = '${room}'
  }
` : '';

  const clientLink = hasClient ? `
// Componente Cliente (Ctrl+Click para navegar)
import type { ${name}Demo as _Client } from '@client/src/live/${name}'
` : '';

  switch (type) {
    case 'counter':
      return `// ${name} - Contador
import { LiveComponent${needsConstructor ? ', type FluxStackWebSocket' : ''} } from '@core/types/types'
${clientLink}

export class ${name} extends LiveComponent<typeof ${name}.defaultState> {
  static componentName = '${name}'
  static publicActions = ['increment', 'decrement', 'reset'] as const
  static defaultState = {
    count: 0
  }

  // Declarar propriedades do estado (criadas dinamicamente)
  declare count: number
${constructorBlock}
  async increment() {
    this.count++
    return { success: true, count: this.count }
  }

  async decrement() {
    this.count--
    return { success: true, count: this.count }
  }

  async reset() {
    this.count = 0
    return { success: true }
  }
}
`;

    case 'form':
      return `// ${name} - Formulário
import { LiveComponent${needsConstructor ? ', type FluxStackWebSocket' : ''} } from '@core/types/types'
${clientLink}

export class ${name} extends LiveComponent<typeof ${name}.defaultState> {
  static componentName = '${name}'
  static publicActions = ['submit', 'reset'] as const
  static defaultState = {
    name: '',
    email: '',
    message: '',
    submitted: false,
    submittedAt: null as string | null
  }
${constructorBlock}
  async submit() {
    if (!this.state.name?.trim() || !this.state.email?.trim()) {
      throw new Error('Nome e email são obrigatórios')
    }
    this.setState({ submitted: true, submittedAt: new Date().toISOString() })
    console.log(\`📝 Form submitted:\`, { name: this.state.name, email: this.state.email })
    return { success: true, data: this.state }
  }

  async reset() {
    this.setState({ ...${name}.defaultState })
    return { success: true }
  }
}
`;

    case 'chat':
      return `// ${name} - Chat
import { LiveComponent${needsConstructor ? ', type FluxStackWebSocket' : ''} } from '@core/types/types'
${clientLink}

export class ${name} extends LiveComponent<typeof ${name}.defaultState> {
  static componentName = '${name}'
  static publicActions = ['sendMessage', 'setUsername'] as const
  static defaultState = {
    messages: [] as Array<{ id: string; text: string; username: string; timestamp: string }>,
    username: '',
    currentMessage: ''
  }
${constructorBlock}
  async sendMessage(payload: { text: string }) {
    if (!payload.text?.trim()) throw new Error('Message cannot be empty')
    const message = {
      id: \`msg-\${Date.now()}-\${Math.random().toString(36).slice(2, 9)}\`,
      text: payload.text.trim(),
      username: this.state.username || 'Anonymous',
      timestamp: new Date().toISOString()
    }
    this.setState({ messages: [...this.state.messages.slice(-49), message], currentMessage: '' })
    if (this.room) this.broadcast('NEW_MESSAGE', { message })
    return { success: true, message }
  }

  async setUsername(payload: { username: string }) {
    if (!payload.username?.trim() || payload.username.length > 20) {
      throw new Error('Username must be 1-20 characters')
    }
    this.setState({ username: payload.username.trim() })
    return { success: true }
  }
}
`;

    default: // basic
      return `// ${name} - Live Component
import { LiveComponent${needsConstructor ? ', type FluxStackWebSocket' : ''} } from '@core/types/types'
${clientLink}

export class ${name} extends LiveComponent<typeof ${name}.defaultState> {
  static componentName = '${name}'
  static publicActions = ['updateMessage', 'increment', 'reset'] as const
  static defaultState = {
    message: 'Hello from ${name}!',
    count: 0
  }

  // Declarar propriedades do estado (criadas dinamicamente)
  declare message: string
  declare count: number
${constructorBlock}
  async updateMessage(payload: { message: string }) {
    if (!payload.message?.trim()) throw new Error('Message cannot be empty')
    this.message = payload.message.trim()
    return { success: true }
  }

  async increment() {
    this.count++
    return { success: true, count: this.count }
  }

  async reset() {
    this.setState({ ...${name}.defaultState })
    return { success: true }
  }
}
`;
  }
};

// ===== CLIENT TEMPLATES =====

const getClientTemplate = (name: string, type: string) => {
  switch (type) {
    case 'counter':
      return `// 🔥 ${name}
import { Live } from '@/core/client'
import { ${name} } from '@server/live/${name}'

export function ${name}Demo() {
  const counter = Live.use(${name}, {
    initialState: ${name}.defaultState
  })

  if (!counter.$connected) return <div className="p-8 text-center text-gray-500">Conectando...</div>

  return (
    <div className="p-6 bg-white rounded-xl shadow-sm border">
      <h2 className="text-xl font-bold mb-4">${name}</h2>
      <div className="text-5xl font-bold text-blue-600 text-center mb-6">{counter.count}</div>
      <div className="flex gap-2 justify-center">
        <button onClick={() => counter.decrement()} disabled={counter.count <= 0} className="px-4 py-2 bg-red-500 text-white rounded-lg disabled:opacity-50">-</button>
        <button onClick={() => counter.increment()} className="px-4 py-2 bg-blue-500 text-white rounded-lg">+</button>
        <button onClick={() => counter.reset()} className="px-4 py-2 bg-gray-500 text-white rounded-lg">Reset</button>
      </div>
    </div>
  )
}
`;

    case 'form':
      return `// 🔥 ${name}
import { Live } from '@/core/client'
import { ${name} } from '@server/live/${name}'

export function ${name}Demo() {
  const form = Live.use(${name}, {
    initialState: ${name}.defaultState
  })

  if (!form.$connected) return <div className="p-8 text-center text-gray-500">Conectando...</div>

  if (form.submitted) {
    return (
      <div className="p-6 bg-green-50 rounded-xl text-center">
        <h2 className="text-xl font-bold text-green-700 mb-2">Enviado!</h2>
        <p className="text-gray-600">Obrigado, {form.name}!</p>
        <button onClick={() => form.reset()} className="mt-4 px-4 py-2 bg-green-500 text-white rounded-lg">Novo</button>
      </div>
    )
  }

  return (
    <div className="p-6 bg-white rounded-xl shadow-sm border">
      <h2 className="text-xl font-bold mb-4">${name}</h2>
      <div className="space-y-4">
        <input {...form.$field('name', { syncOn: 'blur' })} placeholder="Nome" className="w-full px-3 py-2 border rounded-lg" />
        <input {...form.$field('email', { syncOn: 'change', debounce: 500 })} type="email" placeholder="Email" className="w-full px-3 py-2 border rounded-lg" />
        <textarea {...form.$field('message', { syncOn: 'blur' })} placeholder="Mensagem" rows={3} className="w-full px-3 py-2 border rounded-lg" />
        <div className="flex gap-2">
          <button onClick={async () => { try { await form.$sync(); await form.submit() } catch (e: any) { alert(e.message) }}} className="flex-1 px-4 py-2 bg-blue-500 text-white rounded-lg">Enviar</button>
          <button onClick={() => form.reset()} className="px-4 py-2 bg-gray-500 text-white rounded-lg">Limpar</button>
        </div>
      </div>
    </div>
  )
}
`;

    case 'chat':
      return `// 🔥 ${name}
import { useRef, useEffect } from 'react'
import { Live } from '@/core/client'
import { ${name} } from '@server/live/${name}'

export function ${name}Demo() {
  const chat = Live.use(${name}, {
    initialState: ${name}.defaultState
  })
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [chat.messages])

  if (!chat.$connected) return <div className="p-8 text-center text-gray-500">Conectando...</div>

  if (!chat.username) {
    return (
      <div className="p-6 bg-white rounded-xl shadow-sm border max-w-md mx-auto">
        <h2 className="text-xl font-bold mb-4">Entrar no ${name}</h2>
        <input {...chat.$field('username', { syncOn: 'blur' })} placeholder="Seu nome" className="w-full px-3 py-2 border rounded-lg mb-4" maxLength={20} />
        <button onClick={async () => { await chat.$sync(); if (chat.username.trim()) await chat.setUsername({ username: chat.username }) }} className="w-full px-4 py-2 bg-blue-500 text-white rounded-lg">Entrar</button>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-96 bg-white rounded-xl shadow-sm border">
      <div className="p-4 border-b flex justify-between"><h2 className="font-bold">${name}</h2><span className="text-sm text-gray-500">{chat.username}</span></div>
      <div className="flex-1 overflow-y-auto p-4 space-y-2">
        {chat.messages.map((msg) => (
          <div key={msg.id} className={\`flex \${msg.username === chat.username ? 'justify-end' : 'justify-start'}\`}>
            <div className={\`max-w-xs px-3 py-2 rounded-lg \${msg.username === chat.username ? 'bg-blue-500 text-white' : 'bg-gray-100'}\`}>
              {msg.username !== chat.username && <div className="text-xs font-medium mb-1">{msg.username}</div>}
              <div>{msg.text}</div>
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>
      <form onSubmit={async (e) => { e.preventDefault(); if (chat.currentMessage.trim()) await chat.sendMessage({ text: chat.currentMessage }) }} className="p-4 border-t flex gap-2">
        <input {...chat.$field('currentMessage', { syncOn: 'change', debounce: 100 })} placeholder="Mensagem..." className="flex-1 px-3 py-2 border rounded-lg" />
        <button type="submit" className="px-4 py-2 bg-blue-500 text-white rounded-lg">Enviar</button>
      </form>
    </div>
  )
}
`;

    default: // basic
      return `// 🔥 ${name}
import { Live } from '@/core/client'
import { ${name} } from '@server/live/${name}'

export function ${name}Demo() {
  const component = Live.use(${name}, {
    initialState: ${name}.defaultState
  })

  if (!component.$connected) return <div className="p-8 text-center text-gray-500">Conectando...</div>

  return (
    <div className="p-6 bg-white rounded-xl shadow-sm border">
      <h2 className="text-xl font-bold mb-4">${name}</h2>
      <div className="space-y-4">
        <p className="text-lg text-blue-600">{component.message}</p>
        <p className="text-gray-600">Count: <span className="font-bold text-2xl">{component.count}</span></p>
        <div className="flex gap-2">
          <button onClick={() => component.updateMessage({ message: 'Hello!' })} className="px-4 py-2 bg-blue-500 text-white rounded-lg">Update</button>
          <button onClick={() => component.increment()} className="px-4 py-2 bg-green-500 text-white rounded-lg">+1</button>
          <button onClick={() => component.reset()} className="px-4 py-2 bg-gray-500 text-white rounded-lg">Reset</button>
        </div>
      </div>
    </div>
  )
}
`;
  }
};

export const createLiveComponentCommand: CliCommand = {
  name: "make:live",
  description: "Create a new Live Component",
  category: "Live Components",
  aliases: ["make:component", "create:live"],
  usage: "flux make:live <Name> [options]",
  examples: [
    "flux make:live Counter --type=counter",
    "flux make:live ContactForm --type=form",
    "flux make:live Chat --type=chat",
    "flux make:live MyComponent"
  ],
  arguments: [{ name: "Name", description: "Component name in PascalCase", required: true, type: "string" }],
  options: [
    { name: "type", short: "t", description: "Template type", type: "string", default: "basic", choices: ["basic", "counter", "form", "chat"] },
    { name: "no-client", description: "Server only", type: "boolean" },
    { name: "room", short: "r", description: "Default room", type: "string" },
    { name: "force", short: "f", description: "Overwrite", type: "boolean" }
  ],
  handler: async (args, options, context) => {
    const [name] = args;
    const { type = 'basic', 'no-client': noClient, room, force } = options;

    if (!name || !/^[A-Z][a-zA-Z0-9]*$/.test(name)) {
      context.logger.error("❌ Nome inválido. Use PascalCase (ex: MeuComponente)");
      return;
    }

    const serverPath = path.join(context.workingDir, "app", "server", "live", `${name}.ts`);
    const clientPath = path.join(context.workingDir, "app", "client", "src", "live", `${name}.tsx`);

    try {
      if (!force) {
        const serverExists = await fs.access(serverPath).then(() => true).catch(() => false);
        const clientExists = !noClient && await fs.access(clientPath).then(() => true).catch(() => false);
        if (serverExists || clientExists) {
          context.logger.error("❌ Arquivos existem. Use --force para sobrescrever.");
          return;
        }
      }

      await fs.mkdir(path.dirname(serverPath), { recursive: true });
      if (!noClient) await fs.mkdir(path.dirname(clientPath), { recursive: true });

      context.logger.info(`🔥 Criando ${name}...`);

      await fs.writeFile(serverPath, getServerTemplate(name, type, room, !noClient));
      context.logger.info(`   ✅ Server: app/server/live/${name}.ts`);

      if (!noClient) {
        await fs.writeFile(clientPath, getClientTemplate(name, type));
        context.logger.info(`   ✅ Client: app/client/src/live/${name}.tsx`);
      }

      context.logger.info("");
      context.logger.info("🚀 Uso:");
      context.logger.info(`   import { ${name}Demo } from './live/${name}'`);
      context.logger.info(`   <${name}Demo />`);
      context.logger.info("");
      context.logger.info("📖 API:");
      context.logger.info(`   const x = Live.use(${name})           // usa defaultState do backend`);
      context.logger.info(`   const x = Live.use(${name}, { ... })  // com override parcial`);
      context.logger.info(`   x.property    // estado`);
      context.logger.info(`   x.action()    // ação`);
      context.logger.info(`   x.$connected  // status`);

    } catch (error) {
      context.logger.error(`❌ Erro: ${error instanceof Error ? error.message : String(error)}`);
    }
  },
};
