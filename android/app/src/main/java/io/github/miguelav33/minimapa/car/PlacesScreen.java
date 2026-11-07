package io.github.miguelav33.minimapa.car;

import androidx.annotation.NonNull;
import androidx.car.app.CarContext;
import androidx.car.app.CarToast;
import androidx.car.app.Screen;
import androidx.car.app.model.Action;
import androidx.car.app.model.ItemList;
import androidx.car.app.model.ListTemplate;
import androidx.car.app.model.Row;
import androidx.car.app.model.Template;

import org.json.JSONArray;
import org.json.JSONObject;

/** Lista de destinos en el coche: Casa, Trabajo, favoritos, recientes y búsquedas rápidas. */
public class PlacesScreen extends Screen {

    public PlacesScreen(@NonNull CarContext carContext) {
        super(carContext);
    }

    @SuppressWarnings("deprecation")
    @NonNull
    @Override
    public Template onGetTemplate() {
        ItemList.Builder list = new ItemList.Builder();
        int count = 0;

        if (!CarState.get().brainAlive()) {
            list.addItem(new Row.Builder().setTitle("Abre Minimapa en el móvil")
                    .addText("Los destinos y las rutas se calculan en la app del teléfono").build());
            count++;
        } else {
            list.addItem(quick("Gasolinera más barata cerca", "Precio oficial, en 10 km", "fuel-cheap"));
            list.addItem(quick("Gasolinera más cercana", "La más próxima a ti", "fuel"));
            list.addItem(quick("Parking cercano", "El más próximo a ti", "parking"));
            count += 3;
            JSONArray places = CarState.get().places();
            for (int i = 0; i < places.length() && count < 20; i++) {
                final JSONObject p = places.optJSONObject(i);
                if (p == null) continue;
                Row.Builder row = new Row.Builder().setTitle(p.optString("name", "Destino"));
                String sub = p.optString("address");
                if (!sub.isEmpty()) row.addText(sub);
                row.setOnClickListener(() -> {
                    CarState.get().sendAction("navigate", p);
                    CarToast.makeText(getCarContext(), "Calculando ruta a " + p.optString("name"), CarToast.LENGTH_SHORT).show();
                    getScreenManager().pop();
                });
                list.addItem(row.build());
                count++;
            }
            if (places.length() == 0) {
                list.addItem(new Row.Builder().setTitle("Sin lugares guardados")
                        .addText("Guarda Casa, Trabajo o favoritos desde el móvil").build());
            }
        }

        return new ListTemplate.Builder()
                .setTitle("Destinos")
                .setHeaderAction(Action.BACK)
                .setSingleList(list.build())
                .build();
    }

    private Row quick(String title, String text, String kind) {
        return new Row.Builder().setTitle(title).addText(text).setOnClickListener(() -> {
            JSONObject data = new JSONObject();
            try {
                data.put("kind", kind);
            } catch (Exception ignored) {
                // nunca falla con una cadena
            }
            CarState.get().sendAction("nearest", data);
            CarToast.makeText(getCarContext(), "Buscando…", CarToast.LENGTH_SHORT).show();
            getScreenManager().pop();
        }).build();
    }
}
