export interface GestionClientSummary<TDocument> {
  cliente: string;
  docsCliente: readonly TDocument[];
  totalCliente: number;
}

export interface BuildGestionClientSummariesOptions<TDocument> {
  clientes: readonly string[];
  documentos: readonly TDocument[];
  getClientName: (documento: TDocument) => string;
  getAmount: (documento: TDocument) => number;
}

export function buildGestionClientSummaries<TDocument>({
  clientes,
  documentos,
  getClientName,
  getAmount,
}: BuildGestionClientSummariesOptions<TDocument>): readonly GestionClientSummary<TDocument>[] {
  return clientes
    .map((cliente) => {
      const docsCliente = documentos.filter(
        (documento) => getClientName(documento) === cliente,
      );

      const totalCliente = docsCliente.reduce(
        (total, documento) => total + getAmount(documento),
        0,
      );

      return {
        cliente,
        docsCliente,
        totalCliente,
      };
    })
    .sort(
      (left, right) =>
        right.totalCliente - left.totalCliente,
    );
}
