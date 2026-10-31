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

`EXPO_PUBLIC_AUTH_API_BASE_URL` aponta à Autenticação. Cadastro, confirmação e
login usam um cliente separado; operações de imóveis/serviços usam a URL do Core.
As variáveis públicas são acessadas estaticamente para serem incluídas pelo Expo.

## Contratos de integração

Os contratos REST e de eventos estáveis `v1` são mantidos no repositório de documentação, em `../../servico-domestico-docs/contratos/v1` neste workspace. Eles são a fonte de referência para as interfaces em `src/features/operations/contracts/`; o diretório `v0` permanece apenas como baseline histórico.

## Desenvolvimento

```bash
npm install
npm run lint
npx tsc --noEmit
```

### Demonstração offline

Copie `.env.demo.example` para `.env.local` para executar o roteiro técnico
offline. Esse modo só é aceito em `development`, usa adaptadores em memória,
bloqueia chamadas HTTP e mostra a faixa `MOCK — NÃO CONECTADO À HOMOLOGAÇÃO`.
Ele não valida API, HML, pagamento ou E2E e não deve ser usado em exportações de
homologação ou produção.

## Homologação

Copie `.env.homologacao.example` para `.env.local` e substitua os três hosts
`example.invalid` pelas URLs HTTPS verificadas da homologação isolada. Os hosts
de produção descritos na infraestrutura não constituem um ambiente de reset e
falhas controladas. A configuração contém somente URLs públicas, sem segredos.
Fora de `development`, o app rejeita URL HTTP ou `localhost` como API base.
Reinicie o Expo com `npx expo start --clear` após mudar as URLs; gere um novo
build/export para distribuir a configuração atualizada.

### Configuração pública D2-27

`config/homologacao.d2-27.env` contém os hosts planejados da homologação isolada nas VMs atuais. O ambiente só pode ser entregue após o workflow de infraestrutura aprovar HTTPS e qualificação; gerar um bundle não comprova essa prontidão.

No PowerShell, carregue essa configuração explicitamente antes de iniciar o Expo:

```powershell
Get-Content config/homologacao.d2-27.env | ForEach-Object {
  $entry = $_ -split '=', 2
  [Environment]::SetEnvironmentVariable($entry[0], $entry[1], 'Process')
}
$env:EXPO_NO_DOTENV = '1'
npx expo start --clear
```

Para exportar o bundle Android com a mesma configuração, use `npx expo export --platform android --output-dir dist-homologacao`. O export Hermes contém JavaScript e assets; não é um APK instalável. Senhas das contas de teste e tokens não devem ser acrescentados ao arquivo público nem ao bundle.
