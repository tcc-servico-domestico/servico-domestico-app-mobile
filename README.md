# Serviço Doméstico — aplicativo móvel

Este repositório nasceu como uma simulação para a apresentação do TCC1. As telas existentes, a autenticação mockada e o fluxo visual daquela apresentação permanecem preservados.

No TCC2, o mesmo repositório passa a hospedar também o módulo móvel do produto.
Os módulos UC06 (imóveis) e UC07 (serviços, matching, ofertas e execução)
consomem os contratos REST `v1`; UC09 permanece fora deste módulo.

## Estrutura

- `src/app/`: rotas do Expo Router. Esta é a estrutura real de rotas do projeto, em vez do diretório `app` mencionado pelo template original do Expo.
- `src/shared/contracts/`: contratos de sessão e de HTTP que são fornecidos pelo shell do aplicativo.
- `src/features/operations/contracts/`: interfaces e tipos de imóveis, serviços, ofertas e pagamentos usados pelo módulo de operações.
- `src/features/operations/imoveis/`: telas, adaptador e validação do UC06.
- `src/features/operations/servicos/` e `src/features/operations/ofertas/`: adaptadores,
  validação, política de papéis/estados e telas do UC07.

O módulo de operações recebe `OperationsSession` e `OperationsHttpClient` do shell. Ele não implementa armazenamento de token, renovação de sessão, URL-base, interceptadores, navegação raiz ou armazenamento seguro; esses itens permanecem sob responsabilidade do shell.

## Contratos de integração

Os contratos REST e de eventos estáveis `v1` são mantidos no repositório de documentação, em `../../servico-domestico-docs/contratos/v1` neste workspace. Eles são a fonte de referência para as interfaces em `src/features/operations/contracts/`; o diretório `v0` permanece apenas como baseline histórico.

## Desenvolvimento

```bash
npm install
npm run lint
npx tsc --noEmit
```
