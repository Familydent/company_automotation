"""
ПАСПОРТ ОСНОВНОГО СКРИПТА

Скрипт для Windows обрабатывает Excel-выгрузки из папки рядом с собой.
Он считает заявки на листе «Встречи», добавляет итоговую строку в
«Главный Дашборд.xlsx», сохраняет резервную копию Дашборда, затем переносит
успешно обработанную выгрузку в папку «Архив».

Запускается через файл «Запустить-Дашборд.ps1». Логи записываются в log.txt.
"""

from __future__ import annotations

from copy import copy
from datetime import datetime
from pathlib import Path
import shutil
import sys
import traceback

from openpyxl import load_workbook
from openpyxl.styles import Font


# Все рабочие файлы находятся в той же папке, что и этот скрипт.
FOLDER = Path(__file__).resolve().parent
DASHBOARD_PATH = FOLDER / "Главный Дашборд.xlsx"
ARCHIVE_FOLDER = FOLDER / "Архив"
BACKUP_FOLDER = FOLDER / "Резервные копии"
LOG_PATH = FOLDER / "log.txt"
MEETINGS_SHEET_NAME = "Встречи"

DASHBOARD_HEADERS = [
    "Дата и время обработки",
    "Имя выгрузки",
    "Количество заявок",
    "Ожидает ответ",
    "Подтверждено",
    "Нужен email",
    "Прочие статусы",
]


def write_log(message: str) -> None:
    """Добавляет понятную строку с датой и временем в журнал."""
    line = f"[{datetime.now():%Y-%m-%d %H:%M:%S}] {message}"
    with LOG_PATH.open("a", encoding="utf-8") as log_file:
        log_file.write(line + "\n")
    print(line)


def find_column(headers: list[object], header_name: str) -> int:
    """Возвращает номер колонки с нужным заголовком, начиная с нуля."""
    for index, value in enumerate(headers):
        if str(value or "").strip() == header_name:
            return index
    raise ValueError(f"Не найдена колонка «{header_name}» в первой строке листа.")


def get_free_archive_path(source_path: Path) -> Path:
    """Создаёт уникальное имя в Архиве и не перезаписывает старые выгрузки."""
    candidate = ARCHIVE_FOLDER / source_path.name
    number = 1
    while candidate.exists():
        candidate = ARCHIVE_FOLDER / f"{source_path.stem} ({number}){source_path.suffix}"
        number += 1
    return candidate


def copy_previous_row_style(sheet, target_row: int) -> None:
    """Копирует стиль предыдущей строки, чтобы сохранялся внешний вид Дашборда."""
    if target_row <= 2:
        return
    previous_row = target_row - 1
    for column in range(1, len(DASHBOARD_HEADERS) + 1):
        source = sheet.cell(previous_row, column)
        target = sheet.cell(target_row, column)
        if source.has_style:
            target._style = copy(source._style)
        if source.number_format:
            target.number_format = source.number_format
        if source.alignment:
            target.alignment = copy(source.alignment)
        if source.fill:
            target.fill = copy(source.fill)
        if source.border:
            target.border = copy(source.border)
        if source.protection:
            target.protection = copy(source.protection)


def prepare_dashboard():
    """Открывает текущий Дашборд и один раз создаёт заголовки, если он пуст."""
    if not DASHBOARD_PATH.exists():
        raise FileNotFoundError(f"Не найден файл: {DASHBOARD_PATH.name}")

    # openpyxl сохраняет существующие листы, стили и диаграммы. Скрипт меняет
    # только ячейки первой строки пустого Дашборда либо новую итоговую строку.
    workbook = load_workbook(DASHBOARD_PATH)
    sheet = workbook.worksheets[0]

    if all(sheet.cell(1, column).value in (None, "") for column in range(1, 8)):
        for column, header in enumerate(DASHBOARD_HEADERS, start=1):
            cell = sheet.cell(1, column, header)
            cell.font = Font(bold=True)
        write_log("В пустом Дашборде созданы заголовки.")

    return workbook, sheet


def count_meeting_applications(source_path: Path) -> dict[str, int]:
    """Считывает одну выгрузку и возвращает количество заявок по статусам."""
    # Выгрузка открывается только для чтения: исходный файл не меняется.
    workbook = load_workbook(source_path, read_only=True, data_only=True)
    if MEETINGS_SHEET_NAME not in workbook.sheetnames:
        raise ValueError(f"В файле нет листа «{MEETINGS_SHEET_NAME}».")

    sheet = workbook[MEETINGS_SHEET_NAME]
    rows = sheet.iter_rows(values_only=True)
    headers = list(next(rows, ()))
    if not headers:
        raise ValueError("Выгрузка пуста: в ней нет строки заголовков.")

    id_column = find_column(headers, "ID")
    status_column = find_column(headers, "Статус")
    result = {"total": 0, "waiting": 0, "confirmed": 0, "need_email": 0, "other": 0}

    # Каждая строка с непустым ID — отдельная заявка.
    for row in rows:
        identifier = row[id_column] if id_column < len(row) else None
        if identifier in (None, ""):
            continue

        result["total"] += 1
        status = str(row[status_column] if status_column < len(row) else "").strip()
        if status == "Ожидает ответ":
            result["waiting"] += 1
        elif status == "Подтверждено":
            result["confirmed"] += 1
        elif status == "Нужен email":
            result["need_email"] += 1
        else:
            result["other"] += 1

    workbook.close()
    return result


def append_dashboard_row(sheet, source_name: str, counts: dict[str, int]) -> None:
    """Добавляет одну новую строку в конец Дашборда, не трогая старую историю."""
    target_row = sheet.max_row + 1
    copy_previous_row_style(sheet, target_row)

    values = [
        datetime.now(),
        source_name,
        counts["total"],
        counts["waiting"],
        counts["confirmed"],
        counts["need_email"],
        counts["other"],
    ]
    for column, value in enumerate(values, start=1):
        sheet.cell(target_row, column, value)
    sheet.cell(target_row, 1).number_format = "DD.MM.YYYY HH:MM"


def remove_incomplete_dashboard_rows(sheet) -> int:
    """Удаляет только строки от старого неудачного запуска без итоговых цифр."""
    removed = 0
    # Идём снизу вверх, чтобы номера строк не сдвигались при удалении.
    for row_number in range(sheet.max_row, 1, -1):
        source_name = sheet.cell(row_number, 2).value
        counts = [sheet.cell(row_number, column).value for column in range(3, 8)]
        if source_name not in (None, "") and all(value in (None, "") for value in counts):
            sheet.delete_rows(row_number, 1)
            removed += 1
    return removed


def main() -> int:
    """Выполняет полный цикл: подсчёт, запись в Дашборд, архивирование и лог."""
    write_log("Запуск обработки выгрузок.")
    ARCHIVE_FOLDER.mkdir(exist_ok=True)
    BACKUP_FOLDER.mkdir(exist_ok=True)

    # Главный Дашборд и временные файлы Excel не считаются выгрузками.
    source_files = [
        path for path in FOLDER.glob("*.xlsx")
        if path.name != DASHBOARD_PATH.name and not path.name.startswith("~$")
    ]
    dashboard_book, dashboard_sheet = prepare_dashboard()
    incomplete_rows = remove_incomplete_dashboard_rows(dashboard_sheet)
    if incomplete_rows:
        dashboard_book.save(DASHBOARD_PATH)
        write_log(f"Удалено неполных строк от старого запуска: {incomplete_rows}.")

    if not source_files:
        dashboard_book.close()
        write_log("Новых выгрузок не найдено. Работа завершена без изменений.")
        return 0

    for source_path in source_files:
        try:
            counts = count_meeting_applications(source_path)

            # Резервная копия создаётся до сохранения каждой новой строки.
            backup_name = f"Главный Дашборд до {datetime.now():%Y%m%d_%H%M%S_%f}.xlsx"
            shutil.copy2(DASHBOARD_PATH, BACKUP_FOLDER / backup_name)

            append_dashboard_row(dashboard_sheet, source_path.name, counts)
            dashboard_book.save(DASHBOARD_PATH)

            archive_path = get_free_archive_path(source_path)
            shutil.move(str(source_path), str(archive_path))
            write_log(
                f"Обработан файл «{source_path.name}»: заявок {counts['total']}; "
                f"ожидают ответ {counts['waiting']}; подтверждено {counts['confirmed']}; "
                f"нужен email {counts['need_email']}; прочее {counts['other']}. "
                "Перенесён в Архив."
            )
        except Exception as error:
            # При ошибке файл остаётся в исходной папке, чтобы его можно было проверить.
            write_log(f"ОШИБКА в файле «{source_path.name}»: {error}")
            write_log(traceback.format_exc().strip())

    dashboard_book.close()
    write_log("Работа завершена успешно.")
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as critical_error:
        write_log(f"КРИТИЧЕСКАЯ ОШИБКА: {critical_error}")
        raise
