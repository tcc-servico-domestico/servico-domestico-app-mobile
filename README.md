# Serviço Doméstico — aplicativo móvel

Este repositório nasceu como uma simulação para a apresentação do TCC1. As telas existentes, a autenticação mockada e o fluxo visual daquela apresentação permanecem preservados.

No TCC2, o mesmo repositório passa a hospedar também o módulo móvel do produto.
Os módulos UC06 (imóveis), UC07 (serviços, matching, ofertas e execução) e
UC09/UC10 (Pix fake, custódia e consulta de pagamentos) consomem os contratos
REST `v1`.

## Estrutura

- `src/app/`: rotas do Expo Router. Esta é a estrutura real de rotas do projeto, em vez do diretório `app` mencionado pelo template original do Expo.
- `src/shared/contracts/`: contratos de sessão e de HTTP que são fornecidos pelo shell do aplicativo.
- `src/features/operations/contracts/`: interfaces e tipos de imóveis, serviços, ofertas e pagamentos usados pelo módulo de operações.
- `src/features/operations/imoveis/`: telas, adaptador e validação do UC06.
- `src/features/operations/servicos/` e `src/features/operations/ofertas/`: adaptadores,
  validação, política de papéis/estados e telas do UC07.
- `src/features/operations/pagamentos/`: consulta autorizada, acompanhamento
  controlado e persistência protegida de cobrança Pix simulada.

O módulo de operações recebe `OperationsSession` e `OperationsHttpClient` do shell. Armazenamento de token, renovação de sessão, URL-base, interceptadores e navegação raiz permanecem sob responsabilidade do shell. O único armazenamento protegido do módulo é o estado local, temporário e específico de uma cobrança Pix fake.

`EXPO_PUBLIC_API_BASE_URL` aponta ao Core e
`EXPO_PUBLIC_PAYMENT_API_BASE_URL` aponta ao Pagamento. O app nunca chama a
rota interna de criação de cobrança: ela é exclusiva do Core. O copia-e-cola
fake é armazenado em `SecureStore`, delimitado ao usuário autenticado, e é
apagado no logout, expiração ou encerramento financeiro.

## Contratos de integração

Os contratos REST e de eventos estáveis `v1` são mantidos no repositório de documentação, em `../../servico-domestico-docs/contratos/v1` neste workspace. Eles são a fonte de referência para as interfaces em `src/features/operations/contracts/`; o diretório `v0` permanece apenas como baseline histórico.

## Desenvolvimento

```bash
npm install
npm run lint
npx tsc --noEmit
```
