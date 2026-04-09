import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatCurrency, formatMonth } from "@/lib/formatters";
import type {
  KpiDrillType,
  BilledDetail,
  NewDetail,
  ForecastDetail,
  ReceivedDetail,
  CommissionDetail,
  YtdDetail,
} from "@/hooks/useBilling";

interface KpiDrillDownDialogProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  drillType: KpiDrillType | null;
  month: string;
  billedDetail: BilledDetail[];
  newDetail: NewDetail[];
  forecastDetail: ForecastDetail[];
  receivedDetail: ReceivedDetail[];
  commissionDetail: CommissionDetail[];
  ytdDetail: YtdDetail[];
}

const TITLES: Record<KpiDrillType, string> = {
  totalBilled: "Faturamento Total",
  totalNew: "Faturamentos Novos",
  totalForecast: "Previsão",
  totalReceived: "Recebidos",
  totalCommission: "Comissões",
  total2026: "Faturamento 2026",
};

function formatDateBR(dateStr: string): string {
  if (!dateStr) return "—";
  const [y, m, d] = dateStr.split("-");
  return d ? `${d}/${m}/${y}` : dateStr;
}

export function KpiDrillDownDialog({
  open,
  onOpenChange,
  drillType,
  month,
  billedDetail,
  newDetail,
  forecastDetail,
  receivedDetail,
  commissionDetail,
  ytdDetail,
}: KpiDrillDownDialogProps) {
  if (!drillType) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl bg-[#0D1318] border-[#1A2535] text-white">
        <DialogHeader>
          <DialogTitle className="text-lg font-mono text-white">
            {TITLES[drillType]} — {formatMonth(month)}
          </DialogTitle>
        </DialogHeader>
        <div className="max-h-[60vh] overflow-y-auto">
          {drillType === "totalBilled" && <BilledTable data={billedDetail} />}
          {drillType === "totalNew" && <NewTable data={newDetail} />}
          {drillType === "totalForecast" && <ForecastTable data={forecastDetail} />}
          {drillType === "totalReceived" && <ReceivedTable data={receivedDetail} />}
          {drillType === "totalCommission" && <CommissionTable data={commissionDetail} />}
          {drillType === "total2026" && <YtdTable data={ytdDetail} />}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function BilledTable({ data }: { data: BilledDetail[] }) {
  const total = data.reduce((s, r) => s + r.contract_total, 0);
  return (
    <Table>
      <TableHeader>
        <TableRow className="border-[#1A2535]">
          <TableHead className="text-slate-400">Cliente</TableHead>
          <TableHead className="text-slate-400 text-right">Valor Contrato</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {data.map((r, i) => (
          <TableRow key={i} className="border-[#1A2535]">
            <TableCell className="text-slate-200">{r.client_name}</TableCell>
            <TableCell className="text-right text-cyan-400 font-mono">{formatCurrency(r.contract_total)}</TableCell>
          </TableRow>
        ))}
        {data.length === 0 && <EmptyRow cols={2} />}
      </TableBody>
      <TableFooter className="bg-[#111820] border-[#1A2535]">
        <TableRow>
          <TableCell className="text-slate-300 font-semibold">Total</TableCell>
          <TableCell className="text-right text-cyan-400 font-mono font-semibold">{formatCurrency(total)}</TableCell>
        </TableRow>
      </TableFooter>
    </Table>
  );
}

function NewTable({ data }: { data: NewDetail[] }) {
  const total = data.reduce((s, r) => s + r.contract_total, 0);
  return (
    <Table>
      <TableHeader>
        <TableRow className="border-[#1A2535]">
          <TableHead className="text-slate-400">Cliente</TableHead>
          <TableHead className="text-slate-400">Data Fechamento</TableHead>
          <TableHead className="text-slate-400 text-right">Valor Contrato</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {data.map((r, i) => (
          <TableRow key={i} className="border-[#1A2535]">
            <TableCell className="text-slate-200">{r.client_name}</TableCell>
            <TableCell className="text-slate-300 font-mono text-sm">{formatDateBR(r.closing_date)}</TableCell>
            <TableCell className="text-right text-cyan-400 font-mono">{formatCurrency(r.contract_total)}</TableCell>
          </TableRow>
        ))}
        {data.length === 0 && <EmptyRow cols={3} />}
      </TableBody>
      <TableFooter className="bg-[#111820] border-[#1A2535]">
        <TableRow>
          <TableCell colSpan={2} className="text-slate-300 font-semibold">Total</TableCell>
          <TableCell className="text-right text-cyan-400 font-mono font-semibold">{formatCurrency(total)}</TableCell>
        </TableRow>
      </TableFooter>
    </Table>
  );
}

function ForecastTable({ data }: { data: ForecastDetail[] }) {
  const total = data.reduce((s, r) => s + r.predicted_amount, 0);
  return (
    <Table>
      <TableHeader>
        <TableRow className="border-[#1A2535]">
          <TableHead className="text-slate-400">Cliente</TableHead>
          <TableHead className="text-slate-400">Tipo Pgto</TableHead>
          <TableHead className="text-slate-400 text-right">Valor Previsto</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {data.map((r, i) => (
          <TableRow key={i} className="border-[#1A2535]">
            <TableCell className="text-slate-200">{r.client_name}</TableCell>
            <TableCell className="text-slate-300 text-sm">{r.payment_type}</TableCell>
            <TableCell className="text-right text-cyan-400 font-mono">{formatCurrency(r.predicted_amount)}</TableCell>
          </TableRow>
        ))}
        {data.length === 0 && <EmptyRow cols={3} />}
      </TableBody>
      <TableFooter className="bg-[#111820] border-[#1A2535]">
        <TableRow>
          <TableCell colSpan={2} className="text-slate-300 font-semibold">Total</TableCell>
          <TableCell className="text-right text-cyan-400 font-mono font-semibold">{formatCurrency(total)}</TableCell>
        </TableRow>
      </TableFooter>
    </Table>
  );
}

function ReceivedTable({ data }: { data: ReceivedDetail[] }) {
  const total = data.reduce((s, r) => s + r.amount_paid, 0);
  return (
    <Table>
      <TableHeader>
        <TableRow className="border-[#1A2535]">
          <TableHead className="text-slate-400">Cliente</TableHead>
          <TableHead className="text-slate-400 text-right">Valor Recebido</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {data.map((r, i) => (
          <TableRow key={i} className="border-[#1A2535]">
            <TableCell className="text-slate-200">{r.client_name}</TableCell>
            <TableCell className="text-right text-green-400 font-mono">{formatCurrency(r.amount_paid)}</TableCell>
          </TableRow>
        ))}
        {data.length === 0 && <EmptyRow cols={2} />}
      </TableBody>
      <TableFooter className="bg-[#111820] border-[#1A2535]">
        <TableRow>
          <TableCell className="text-slate-300 font-semibold">Total</TableCell>
          <TableCell className="text-right text-green-400 font-mono font-semibold">{formatCurrency(total)}</TableCell>
        </TableRow>
      </TableFooter>
    </Table>
  );
}

function CommissionTable({ data }: { data: CommissionDetail[] }) {
  const total = data.reduce((s, r) => s + r.commission_value, 0);
  return (
    <Table>
      <TableHeader>
        <TableRow className="border-[#1A2535]">
          <TableHead className="text-slate-400">Cliente</TableHead>
          <TableHead className="text-slate-400 text-right">Recebido</TableHead>
          <TableHead className="text-slate-400 text-right">Taxa</TableHead>
          <TableHead className="text-slate-400 text-right">Comissão</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {data.map((r, i) => (
          <TableRow key={i} className="border-[#1A2535]">
            <TableCell className="text-slate-200">{r.client_name}</TableCell>
            <TableCell className="text-right text-slate-300 font-mono">{formatCurrency(r.amount_paid)}</TableCell>
            <TableCell className="text-right text-slate-300 font-mono">{(r.commission_rate * 100).toFixed(0)}%</TableCell>
            <TableCell className="text-right text-amber-400 font-mono">{formatCurrency(r.commission_value)}</TableCell>
          </TableRow>
        ))}
        {data.length === 0 && <EmptyRow cols={4} />}
      </TableBody>
      <TableFooter className="bg-[#111820] border-[#1A2535]">
        <TableRow>
          <TableCell colSpan={3} className="text-slate-300 font-semibold">Total</TableCell>
          <TableCell className="text-right text-amber-400 font-mono font-semibold">{formatCurrency(total)}</TableCell>
        </TableRow>
      </TableFooter>
    </Table>
  );
}

function YtdTable({ data }: { data: YtdDetail[] }) {
  const total = data.reduce((s, r) => s + r.amount_paid, 0);
  return (
    <Table>
      <TableHeader>
        <TableRow className="border-[#1A2535]">
          <TableHead className="text-slate-400">Mês</TableHead>
          <TableHead className="text-slate-400">Cliente</TableHead>
          <TableHead className="text-slate-400 text-right">Valor Recebido</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {data.map((r, i) => (
          <TableRow key={i} className="border-[#1A2535]">
            <TableCell className="text-slate-300 font-mono text-sm">{formatMonth(r.reference_month)}</TableCell>
            <TableCell className="text-slate-200">{r.client_name}</TableCell>
            <TableCell className="text-right text-amber-400 font-mono">{formatCurrency(r.amount_paid)}</TableCell>
          </TableRow>
        ))}
        {data.length === 0 && <EmptyRow cols={3} />}
      </TableBody>
      <TableFooter className="bg-[#111820] border-[#1A2535]">
        <TableRow>
          <TableCell colSpan={2} className="text-slate-300 font-semibold">Total</TableCell>
          <TableCell className="text-right text-amber-400 font-mono font-semibold">{formatCurrency(total)}</TableCell>
        </TableRow>
      </TableFooter>
    </Table>
  );
}

function EmptyRow({ cols }: { cols: number }) {
  return (
    <TableRow className="border-[#1A2535]">
      <TableCell colSpan={cols} className="text-center text-slate-500 py-8">
        Nenhum registro encontrado
      </TableCell>
    </TableRow>
  );
}
