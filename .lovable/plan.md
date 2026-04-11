

# Atualizar DESPESA_OPTIONS + labels de categorias

## Mudanças em 2 arquivos

### 1. `src/pages/ReconciliationPage.tsx`
- **Linhas 31-55**: Substituir `DESPESA_OPTIONS` inteiro pelo novo array (30 categorias, ordem alfabética, inclui novas: camila, estudo, família, plataformas_ia, aluguel, kitnets_manutencao)
- **Linhas 68-82**: Adicionar no `ALL_CATEGORY_LABELS` as entradas faltantes: camila, estudo, familia, farmacia, gasolina, gas, plataformas_ia, terapia, terrenos, viagens, aluguel

### 2. `src/lib/categorizeTransaction.ts`
- **Linhas 144-155**: Adicionar no `CATEGORY_LABELS` as mesmas entradas: camila, estudo, familia, farmacia, gasolina, plataformas_ia, terapia, terrenos, aluguel

Nenhuma lógica alterada — apenas listas de opções e labels.

