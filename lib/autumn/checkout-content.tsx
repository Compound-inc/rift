import { type CheckoutResult } from "autumn-js";

function formatPlanName(name: string): string {
  const lower = name.toLowerCase();
  if (lower === "plus") return "Plus";
  if (lower === "pro") return "Pro";
  return name.charAt(0).toUpperCase() + name.slice(1).toLowerCase();
}

export const getCheckoutContent = (checkoutResult: CheckoutResult) => {
  const { product, current_product, next_cycle } = checkoutResult;
  const { is_one_off, is_free, has_trial, updateable } = product.properties;
  const scenario = product.scenario;

  const nextCycleAtStr = next_cycle
    ? new Date(next_cycle.starts_at).toLocaleDateString("es-MX")
    : undefined;

  const productName = formatPlanName(product.name);
  const currentProductName = current_product
    ? formatPlanName(current_product.name)
    : "";

  if (is_one_off) {
    return {
      title: <p>Comprar {productName}</p>,
      message: (
        <p>
          Al confirmar, se cobrará a tu método de pago el monto indicado más
          abajo.
        </p>
      ),
    };
  }

  if (scenario == "active" && updateable) {
    if (updateable) {
      return {
        title: <p>Actualizar cantidad del plan</p>,
        message: (
          <p>
            Puedes cambiar la cantidad prepagada. La diferencia se cobrará o
            acreditará de forma prorrateada según tu ciclo actual.
          </p>
        ),
      };
    }
  }

  if (has_trial) {
    return {
      title: <p>Prueba gratuita de {productName}</p>,
      message: (
        <p>
          Al confirmar, comenzará tu prueba gratuita de {productName}. La prueba
          termina el {nextCycleAtStr}.
        </p>
      ),
    };
  }

  switch (scenario) {
    case "scheduled":
      return {
        title: <p>Cambio ya programado</p>,
        message: (
          <p>
            Tu paso a {productName} ya está programado para el {nextCycleAtStr}.
            No necesitas hacer nada más.
          </p>
        ),
      };

    case "active":
      return {
        title: <p>Ya tienes este plan</p>,
        message: (
          <p>Tu suscripción a {productName} ya está activa.</p>
        ),
      };

    case "new":
      if (is_free) {
        return {
          title: <p>Activar {productName}</p>,
          message: (
            <p>
              Al confirmar, se activará {productName} de inmediato y no se
              realizará ningún cargo.
            </p>
          ),
        };
      }

      return {
        title: <p>Suscribirte a {productName}</p>,
        message: (
          <p>
            Al confirmar, se activará tu suscripción a {productName} y se
            cobrará el monto indicado a tu método de pago.
          </p>
        ),
      };
    case "renew":
      return {
        title: <p>Renovar suscripción</p>,
        message: (
          <p>
            Al confirmar, se renovará tu suscripción a {productName} y se
            realizará el cargo correspondiente.
          </p>
        ),
      };

    case "upgrade":
      return {
        title: <p>Subir a {productName}</p>,
        message: (
          <p>
            Al confirmar, pasarás al plan {productName}. Se cobrará a tu método
            de pago el monto indicado (prorrateado si aplica).
          </p>
        ),
      };

    case "downgrade":
      return {
        title: <p>Bajar a {productName}</p>,
        message: (
          <p>
            Tu plan actual ({currentProductName}) se dará de baja y el plan{" "}
            {productName} comenzará el {nextCycleAtStr}. El monto a pagar hoy se
            muestra abajo.
          </p>
        ),
      };

    case "cancel":
      return {
        title: <p>Cancelar suscripción</p>,
        message: (
          <p>
            Tu suscripción a {currentProductName} terminará el{" "}
            {nextCycleAtStr}. A partir de esa fecha no se realizarán más cargos.
          </p>
        ),
      };

    default:
      return {
        title: <p>Cambio de plan</p>,
        message: (
          <p>
            Revisa el resumen y el monto a pagar antes de confirmar el cambio.
          </p>
        ),
      };
  }
};
