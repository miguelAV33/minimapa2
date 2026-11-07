package io.github.miguelav33.minimapa.car;

import androidx.annotation.NonNull;
import androidx.car.app.CarAppService;
import androidx.car.app.Session;
import androidx.car.app.validation.HostValidator;

/** Punto de entrada de Android Auto. */
public class MinimapaCarAppService extends CarAppService {

    @NonNull
    @Override
    public HostValidator createHostValidator() {
        // App de uso personal instalada fuera de Play Store: se acepta cualquier anfitrión
        // (Android Auto, el emulador DHU, etc.).
        return HostValidator.ALLOW_ALL_HOSTS_VALIDATOR;
    }

    @NonNull
    @Override
    public Session onCreateSession() {
        return new MinimapaSession();
    }
}
