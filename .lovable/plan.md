

# 2 Ajustes Pré-Sprint 2

## 1. Remover AuthGuard da rota `/manager/kitnets`
In `src/App.tsx`, change the manager route from `<AuthGuard><ManagerKitnetsPage /></AuthGuard>` to just `<ManagerKitnetsPage />` — the page already handles its own role verification internally.

## 2. Seed das 13 kitnets
Insert the 13 kitnet records (8 RWT02 + 5 RWT03) into the `kitnets` table using the database insert tool with the exact data provided (tenant names, rent values, statuses, bank details).

