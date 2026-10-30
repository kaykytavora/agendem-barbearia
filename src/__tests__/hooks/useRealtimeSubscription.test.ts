import { renderHook } from "@testing-library/react";

const { channelMock, removeChannelMock } = vi.hoisted(() => {
  const canal = { on: vi.fn(), subscribe: vi.fn() };
  canal.on.mockReturnValue(canal);
  canal.subscribe.mockReturnValue(canal);
  return { channelMock: vi.fn(() => canal), removeChannelMock: vi.fn() };
});

vi.mock("@/integrations/supabase/client", () => ({
  supabase: { channel: channelMock, removeChannel: removeChannelMock },
}));

import { useRealtimeSubscription } from "@/hooks/useRealtimeSubscription";

describe("useRealtimeSubscription", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    channelMock.mockClear();
    removeChannelMock.mockClear();
  });
  afterEach(() => vi.useRealTimers());

  it("não recria o canal quando a tela re-renderiza com um onUpdate novo", () => {
    const { rerender } = renderHook(({ cb }) => useRealtimeSubscription({ channelName: "c", table: "agendamentos", onUpdate: cb, delay: 100 }), {
      initialProps: { cb: () => {} },
    });
    vi.advanceTimersByTime(100);
    rerender({ cb: () => {} });
    rerender({ cb: () => {} });
    vi.advanceTimersByTime(500);

    expect(channelMock).toHaveBeenCalledTimes(1);
    expect(removeChannelMock).not.toHaveBeenCalled();
  });

  it("não abre conexão se a tela sair antes do atraso", () => {
    const { unmount } = renderHook(() => useRealtimeSubscription({ channelName: "c", table: "agendamentos", onUpdate: () => {}, delay: 1000 }));
    vi.advanceTimersByTime(300);
    unmount();
    vi.advanceTimersByTime(2000);

    expect(channelMock).not.toHaveBeenCalled();
  });
});
