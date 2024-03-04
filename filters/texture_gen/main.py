import os, sys
import glob
import json
from PIL import Image, ImageEnhance
import numpy as np

# store paths for using in the main function of the filter
dir_project = os.environ["ROOT_DIR"]
dir_filter_data = os.path.join(dir_project, "packs\\data\\texture_gen")
dir_BP = "BP"
dir_RP = "RP"

# stolen directly from the json_cleaner regolith filter.
# this function is not my property, and was not written by me.
def get_commented_json(fh):
    try:
        # If possible, read the file as JSON
        return json.loads(fh)
    except:
        # If not, read the file as a string, and try to parse it as JSON
        contents = ""
        for line in fh.splitlines():
            cleanedLine = line.split("//", 1)[0]
            if len(cleanedLine) > 0 and line.endswith("\n") and "\n" not in cleanedLine:
                cleanedLine += "\n"
            contents += cleanedLine
        while "/*" in contents:
            preComment, postComment = contents.split("/*", 1)
            contents = preComment + postComment.split("*/", 1)[1]
        return json.loads(contents)

def find_json_files(directory):
    # create a recursive pattern to search for all .json files in the directory and its subdirectories
    pattern = os.path.join(directory, '**', '*.json')
    # use the glob module to find files matching the pattern
    json_files = glob.glob(pattern, recursive=True)
    return json_files

def process_filter(image: Image.Image, filter:dict):
    filter_name = filter.get("filter", None)

    if filter_name is None:
        print("Error: No filter name provided")
        print(filter)
        return image
    
    elif filter_name == "hsv":
        rgba_array = np.array(image)
        image_hsv = image.convert("HSV")
        hsv_array = np.array(image_hsv)

        # apply the required h s v modifications
        hsv_array[:,:,0] = (hsv_array[:,:,0]+filter.get("h", 0))%256
        hsv_array[:,:,1] = np.clip(hsv_array[:,:,1]*filter.get("s", 1), 0, 255)
        hsv_array[:,:,2] = np.clip(hsv_array[:,:,2]*filter.get("v", 1), 0, 255)

        # convert hsv image to rgb
        rgb_image = Image.fromarray(hsv_array, "HSV").convert("RGB")

        # get the alpha channel from the original RGBA array
        alpha_channel = rgba_array[:, :, 3]

        # create a new RGBA image by combining the RGB values with the original alpha channel
        rgba_result = np.concatenate((np.array(rgb_image), alpha_channel[:, :, None]), axis=-1)

        # convert the result back to a PIL image
        result_image = Image.fromarray(rgba_result, 'RGBA')

        # return the result
        return result_image
    
    elif filter_name == "overlay":
        overlay_path_relative = filter.get("path", None)
        if overlay_path_relative is None:
            print("Error: No path provided in overlay filter")
            return image
        overlay_path = os.path.join(dir_RP, overlay_path_relative)
        overlay_image = Image.open(overlay_path).convert("RGBA")
        overlay_alpha = overlay_image.split()[3]
        result_image = image.copy()
        result_image.paste(overlay_image, (0,0), overlay_alpha)
        return result_image
    
    elif filter_name == "contrast":
        factor = filter.get("factor", 1)
        enhancer = ImageEnhance.Contrast(image)
        return enhancer.enhance(factor)
    
    elif filter_name == "set_alpha":
        value = filter.get("value", 1)
        rgba_array = np.array(image)
        rgba_array[rgba_array[:, :, 3] == 255, 3] = value
        result_image = Image.fromarray(rgba_array, 'RGBA')
        return result_image
    
    else:
        print(f"Error: Unknown filter name? {filter_name}")
        print(filter)
        return image


def process_texture(texture):
    """Process a texture. Textures are provided like so:
    {
        "base_path": path_to_image,
        "creates": [
            {
                "path": path_to_image,
                "filters": list_of_filters
            }
        ]
    }
    """

    try:
        image_path = os.path.join(dir_RP, texture.get("base_path", ""))
        image = Image.open(image_path).convert("RGBA")
    except:
        print("Error opening base_path for texture")
        return

    for create in texture.get("creates", []):
        # process filters list
        image_tmp = image.copy()
        for filter in create.get("filters", []):
            image_tmp = process_filter(image_tmp, filter)
        # save final texture to path
        output_path_relative = create.get("path", None)
        if output_path_relative is None:
            print("Error: No path specified in create")
            return
        output_path = os.path.join(dir_RP, output_path_relative)
        image_tmp.save(output_path)

def main():
    """
    The entry point for the script.
    """
    try:
        settings = json.loads(sys.argv[1])
    except IndexError:
        print("Warning: No settings provided. Using default settings.")
        settings = {}
    
    cleanup = settings.get("cleanup", False)
    overwrite = settings.get("overwrite", True)
    
    data_file_path = os.path.join(dir_filter_data, "textures.json")
    if not os.path.exists(data_file_path):
        print("Error: No textures.json data file found")
        return False
    with open(data_file_path) as file:
        data: dict
        data = get_commented_json(file.read())
    
    textures = data.get("textures", [])
    if len(textures) == 0:
        print("Warning: No textures defined")
        return False
    
    for texture in textures:
        process_texture(texture)

if __name__ == "__main__":
    main()