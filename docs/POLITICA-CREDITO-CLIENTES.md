# Política de crédito por cliente

1. Si Contífico entrega una fecha de vencimiento posterior a la emisión, se conserva.
2. Si la fecha es igual, vacía o anterior, se usa la política del cliente.
3. Si el cliente no tiene política, se marca como pendiente y se genera alerta.
4. La columna `fecha_vencimiento` sigue siendo la única usada por aging, alertas y reportes.
5. No se guarda una copia adicional de la fecha original.
