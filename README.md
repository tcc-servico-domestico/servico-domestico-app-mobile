# Serviço Doméstico — aplicativo móvel

Este repositório nasceu como uma simulação para a apresentação do TCC1. As telas existentes, a autenticação mockada e o fluxo visual daquela apresentação permanecem preservados.

No TCC2, o mesmo repositório passa a hospedar também o módulo móvel do produto. Nesta etapa, ele contém somente os contratos TypeScript do módulo de operações; UC06, UC07 e UC09 ainda não são implementados aqui.

## Estrutura

- `src/app/`: rotas do Expo Router. Esta é a estrutura real de rotas do projeto, em vez do diretório `app` mencionado pelo template original do Expo.
- `src/shared/contracts/`: contratos de sessão e de HTTP que são fornecidos pelo shell do aplicativo.
- `src/features/operations/contracts/`: interfaces e tipos de imóveis, serviços, ofertas e pagamentos usados pelo módulo de operações.

O módulo de operações recebe `OperationsSession` e `OperationsHttpClient` do shell. Ele não implementa armazenamento de token, renovação de sessão, URL-base, interceptadores, navegação raiz ou armazenamento seguro; esses itens permanecem sob responsabilidade do shell.

## Contratos de integração

Os contratos REST e de eventos estáveis `v1` são mantidos no repositório de documentação, em `../../servico-domestico-docs/contratos/v1` neste workspace. Eles são a fonte de referência para as interfaces em `src/features/operations/contracts/`; o diretório `v0` permanece apenas como baseline histórico.

## Desenvolvimento

```bash
npm install
npm run lint
npx tsc --noEmit
```
