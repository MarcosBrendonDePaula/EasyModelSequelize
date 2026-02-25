// 🔥 FormDemo - Exemplo de Live Component
import { Live } from '@/core/client'
import { LiveForm } from '@server/live/LiveForm'

export function FormDemo() {
  // ✨ Usa defaultState do backend automaticamente
  const form = Live.use(LiveForm)

  // Sucesso
  if (form.submitted) {
    return (
      <div className="p-4 sm:p-6 bg-green-500/20 border border-green-500/30 rounded-xl text-center w-full max-w-xl mx-auto">
        <div className="text-4xl mb-3">✅</div>
        <h2 className="text-xl font-bold text-white mb-2">Enviado!</h2>
        <p className="text-gray-300">Obrigado, <span className="text-green-400">{form.name}</span>!</p>
        <p className="text-gray-400 text-sm mt-2">
          Enviado em: {form.submittedAt ? new Date(form.submittedAt).toLocaleString() : '-'}
        </p>
        <button
          onClick={() => form.reset()}
          className="mt-4 px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-all"
        >
          Novo Formulário
        </button>
      </div>
    )
  }

  return (
    <div className="p-4 sm:p-6 bg-white/10 backdrop-blur-sm border border-white/20 rounded-xl w-full max-w-xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold text-white">Live Form</h2>
        <span className={`px-3 py-1 rounded-full text-xs ${
          form.$connected ? 'bg-green-500/20 text-green-300' : 'bg-red-500/20 text-red-300'
        }`}>
          {form.$connected ? '🟢 Conectado' : '🔴 Desconectado'}
        </span>
      </div>

      <div className="space-y-4">
        {/* Nome - sync on blur */}
        <div>
          <label className="block text-gray-300 text-sm mb-1">
            Nome <span className="text-purple-400 text-xs">(sync: blur)</span>
          </label>
          <input
            {...form.$field('name', { syncOn: 'blur' })}
            placeholder="Seu nome"
            className="w-full px-4 py-3 bg-white/5 border border-white/20 rounded-lg text-white placeholder-gray-500 focus:border-purple-500 focus:outline-none"
          />
        </div>

        {/* Email - sync on change with debounce */}
        <div>
          <label className="block text-gray-300 text-sm mb-1">
            Email <span className="text-blue-400 text-xs">(sync: 500ms)</span>
          </label>
          <input
            {...form.$field('email', { syncOn: 'change', debounce: 500 })}
            type="email"
            placeholder="seu@email.com"
            className="w-full px-4 py-3 bg-white/5 border border-white/20 rounded-lg text-white placeholder-gray-500 focus:border-purple-500 focus:outline-none"
          />
        </div>

        {/* Mensagem - sync on blur */}
        <div>
          <label className="block text-gray-300 text-sm mb-1">
            Mensagem <span className="text-orange-400 text-xs">(sync: blur)</span>
          </label>
          <textarea
            {...form.$field('message', { syncOn: 'blur' })}
            rows={3}
            placeholder="Sua mensagem..."
            className="w-full px-4 py-3 bg-white/5 border border-white/20 rounded-lg text-white placeholder-gray-500 focus:border-purple-500 focus:outline-none resize-none"
          />
        </div>

        {/* Botões */}
        <div className="flex gap-2">
          <button
            onClick={async () => {
              try {
                await form.$sync()
                await form.submit()
              } catch (err: any) {
                alert(err.message || 'Erro ao enviar')
              }
            }}
            disabled={!form.$connected}
            className="flex-1 px-4 py-3 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-lg font-medium hover:shadow-lg hover:shadow-purple-500/30 transition-all disabled:opacity-50"
          >
            {form.$loading ? 'Enviando...' : 'Enviar'}
          </button>
          <button
            onClick={() => form.reset()}
            className="px-4 py-3 bg-gray-600 text-white rounded-lg hover:bg-gray-500 transition-all"
          >
            Limpar
          </button>
        </div>
      </div>

      {/* Legenda */}
      <div className="mt-4 p-3 bg-white/5 rounded-lg text-xs text-gray-400 space-y-1">
        <p><span className="text-purple-400">blur:</span> Sincroniza ao sair do campo</p>
        <p><span className="text-blue-400">500ms:</span> Sincroniza 500ms após parar de digitar</p>
      </div>

      {/* Debug */}
      <details className="mt-4">
        <summary className="text-gray-400 text-sm cursor-pointer">Debug State (servidor)</summary>
        <pre className="mt-2 p-3 bg-black/40 rounded-lg text-xs text-green-400 overflow-auto">
{JSON.stringify(form.$state, null, 2)}
        </pre>
      </details>
    </div>
  )
}
