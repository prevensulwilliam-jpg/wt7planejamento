

# Correção do bug parseExcelDate — off-by-one do SheetJS

## Problema
`XLSX.SSF.parse_date_code` soma +1 dia nas datas. Exemplo: planilha tem `28/02/2026`, banco grava `2026-03-01`. Isso causa valores em meses errados.

## Mudanças

### 1. Substituir `parseExcelDate` em `CommissionsPortalPage.tsx` (linhas 523-533)
Trocar `XLSX.SSF.parse_date_code` pela fórmula UTC direta `(val - 25569) * 86400 * 1000`. Adicionar suporte a formato `DD/MM` (sem ano).

### 2. Substituir `parseExcelDate` em `FinancialBillingPage.tsx` (linhas 303-313)
Mesma correção — o bug existe nos dois arquivos.

### Código novo (ambos os arquivos)
```typescript
const parseExcelDate = (val: any): string | null => {
    if (typeof val === "number") {
      const utc = (val - 25569) * 86400 * 1000;
      const date = new Date(utc);
      const y = date.getUTCFullYear();
      const m = String(date.getUTCMonth() + 1).padStart(2, '0');
      const d = String(date.getUTCDate()).padStart(2, '0');
      if (y > 2000 && y < 2100) return `${y}-${m}-${d}`;
      return null;
    }
    if (typeof val === "string") {
      const full = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(val.trim());
      if (full) return `${full[3]}-${full[2].padStart(2,'0')}-${full[1].padStart(2,'0')}`;
      const short = /^(\d{1,2})\/(\d{1,2})$/.exec(val.trim());
      if (short) {
        const year = new Date().getFullYear();
        return `${year}-${short[2].padStart(2,'0')}-${short[1].padStart(2,'0')}`;
      }
    }
    return null;
  };
```

## Nota
Os dados já gravados no banco com datas erradas precisarão ser corrigidos manualmente (apagar histórico e reimportar) ou via SQL update. Esta correção só afeta importações futuras.

