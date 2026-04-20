package com.bigbike.bigbike_backend.service.common;

import java.util.List;
import org.springframework.stereotype.Service;

@Service
public class PaginationService {

    public <T> PageResult<T> paginate(List<T> source, int page, int size) {
        int totalItems = source.size();
        int totalPages = totalItems == 0 ? 0 : (int) Math.ceil((double) totalItems / size);

        int fromIndex = (page - 1) * size;
        if (fromIndex >= totalItems) {
            return new PageResult<>(List.of(), page, size, totalItems, totalPages);
        }

        int toIndex = Math.min(fromIndex + size, totalItems);
        List<T> pageItems = source.subList(fromIndex, toIndex);

        return new PageResult<>(pageItems, page, size, totalItems, totalPages);
    }
}
