
interface TrackingHandlerDependencies {
  getAuthenticatedUser: () => Promise<{ id: string } | null>;
  createTrackedOrder: (
    orderId: string,
    userId: string,
  ) => Promise<unknown>;
}

export function createOrderTrackingHandler(
  dependencies: TrackingHandlerDependencies,
) {
  return async (request: Request): Promise<Response> => {
    try {
      const user = await dependencies.getAuthenticatedUser();

      if (!user) {
        return Response.json(
          { error: "Unauthorized. Please log in." },
          { status: 401 },
        );
      }

      let body: { orderId?: unknown };

      try {
        body = await request.json();
      } catch {
        return Response.json(
          { error: "Invalid JSON request body." },
          { status: 400 },
        );
      }

      const orderId = body?.orderId;

      if (typeof orderId !== "string" || !orderId.trim()) {
        return Response.json(
          { error: "A valid order ID is required." },
          { status: 400 },
        );
      }

      const order = await dependencies.createTrackedOrder(
        orderId.trim(),
        user.id,
      );

      return Response.json(
        {
          message: "Order tracking created successfully.",
          order,
        },
        { status: 201 },
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : "";

      if (message === "Order not found.") {
        return Response.json(
          { error: message },
          { status: 404 },
        );
      }

      if (message === "Order tracking requires successful payment.") {
        return Response.json(
          { error: message },
          { status: 400 },
        );
      }

      console.error("Order tracking POST error:", error);

      return Response.json(
        { error: "Unable to create order tracking." },
        { status: 500 },
      );
    }
  };
}
