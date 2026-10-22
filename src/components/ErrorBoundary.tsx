import React from 'react';

type ErrorBoundaryState = { error: Error | null };

/**
 * Evita que um erro de render deixe a aplicação em branco:
 * mostra uma mensagem com a opção de recarregar.
 */
export class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  ErrorBoundaryState
> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo): void {
    console.error('[app] render error', error, info.componentStack);
  }

  render(): React.ReactNode {
    const { error } = this.state;
    if (!error) return this.props.children;

    return (
      <div className="flex min-h-dvh items-center justify-center bg-[#0a0a0a] px-4 text-zinc-100">
        <div className="w-full max-w-md rounded-3xl border border-white/10 bg-white/[0.04] p-6 text-center">
          <h1 className="text-lg font-bold text-white">Algo deu errado ao desenhar a página</h1>
          <p className="mt-2 text-sm text-zinc-400">
            Os dados carregados não foram enviados para nenhum servidor. Recarregue para voltar a
            começar.
          </p>
          <pre className="mt-3 max-h-32 overflow-auto rounded-xl bg-black/40 p-3 text-left text-[11px] text-zinc-400">
            {error.message}
          </pre>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="mt-4 min-h-[44px] rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-bold text-white transition-colors hover:bg-blue-500"
          >
            Recarregar
          </button>
        </div>
      </div>
    );
  }
}
