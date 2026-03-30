

# Feature — Fornecedores do Casamento: upload de contrato + controle de pagamentos

## Summary
Create `wedding_vendors` and `wedding_vendor_payments` tables, a `wedding-docs` storage bucket, add CRUD hooks, and replace the static suppliers tab in `WeddingPage.tsx` with a fully dynamic vendor management system including contract upload and payment tracking.

## 1. Database Migration
- Create `wedding_vendors` table (service, vendor_name, status, estimated_value, contracted_value, contract_file_url/name, notes)
- Create `wedding_vendor_payments` table (vendor_id FK, description, amount, due_date, paid_at, status, payment_method, receipt_url/name, notes)
- Enable RLS with admin-only policies on both tables
- Create `wedding-docs` storage bucket (public) with open access policy
- Seed 18 known vendors from the existing static array

## 2. Hooks — `src/hooks/useConstructions.ts`
Add at the end of the file:
- `useWeddingVendors()` — fetches vendors with nested payments via `select("*, wedding_vendor_payments(*)")`
- `useCreateWeddingVendor()`, `useUpdateWeddingVendor()`, `useDeleteWeddingVendor()`
- `useCreateVendorPayment()`, `useUpdateVendorPayment()`, `useDeleteVendorPayment()`
- `uploadWeddingFile(file, path)` — uploads to `wedding-docs` bucket, returns public URL

## 3. WeddingPage.tsx — Replace Fornecedores tab
- Remove the static `suppliers` array (lines 20-38) and `statusBadge` object (lines 41-46)
- Add imports: `Plus`, `Trash2` from lucide, AlertDialog components, Select, Dialog, Input, useQueryClient, and the new hooks
- Replace `<TabsContent value="fornecedores">` with a `<VendorsTab />` component containing:
  - **4 KPI cards**: Estimado Total, Contratado, Já Pago, A Pagar
  - **Vendor cards** with status badge, contract indicator, payment summary, "Gerenciar" button
  - **New vendor dialog** with service, name, status, values, notes
- Add `VendorDetailModal` component with:
  - **Vendor data section**: edit name, status, contracted value, notes
  - **Contract section**: upload/replace PDF/image, view existing
  - **Payments section**: list with mark-as-paid, receipt upload, add new payment form
  - **Delete vendor** (except "incluido_pacote")

## Files Changed
| File | Action |
|------|--------|
| DB migration | Create 2 tables + RLS + storage bucket + seed data |
| `src/hooks/useConstructions.ts` | Add 7 hooks + uploadWeddingFile utility |
| `src/pages/WeddingPage.tsx` | Remove static suppliers, add VendorsTab + VendorDetailModal components |

